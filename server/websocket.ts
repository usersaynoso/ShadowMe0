import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { storage } from './storage'; // Import storage
import { InsertNotification, chat_rooms } from '@shared/schema'; // Import InsertNotification type and chat_rooms
import { eq } from 'drizzle-orm';
import { db } from './db'; // Import db

interface ServerToClientEvents {
  receiveMessage: (message: { user: string; text: string; media?: string[], recipientId?: string, roomId?: string }) => void;
  newNotification: (data: { senderId: string, roomId?: string, message?: any }) => void;
  newMessage: (message: any) => void;
  messagesRead: (data: { readByUserId: string, roomId: string, messages: any[] }) => void;
}

interface ClientToServerEvents {
  sendMessage: (data: { roomId: string; content: string; /* remove recipientId, media, messageId as they are not in the new spec */ }) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  markMessagesAsRead: (data: { roomId: string }) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  userId: string;
  displayName?: string; // Store displayName if available after auth
}

// Socket.IO server instance reference
let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Map to track active users and their socket IDs
// This allows us to find a user's socket ID by their user ID
const userSocketMap = new Map<string, Set<string>>();

// Helper function to register a socket ID for a user
const registerUserSocket = (userId: string, socketId: string) => {
  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId)!.add(socketId);
  console.log(`[WebSocket] Registered socket ${socketId} for user ${userId}. Active sockets: ${userSocketMap.get(userId)!.size}`);
};

// Helper function to unregister a socket ID for a user
const unregisterUserSocket = (userId: string, socketId: string) => {
  if (userSocketMap.has(userId)) {
    userSocketMap.get(userId)!.delete(socketId);
    // If this was the last socket for this user, remove the user entry
    if (userSocketMap.get(userId)!.size === 0) {
      userSocketMap.delete(userId);
    }
    console.log(`[WebSocket] Unregistered socket ${socketId} for user ${userId}`);
  }
};

// Helper function to get all socket IDs for a user
const getSocketIdsForUser = (userId: string): string[] => {
  if (userSocketMap.has(userId)) {
    return Array.from(userSocketMap.get(userId)!);
  }
  return [];
};

// Getter function to access the Socket.IO server instance
export const getIO = (): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> => {
  if (!io) {
    throw new Error('Socket.IO server not initialized');
  }
  return io;
};

export const initWebSocketServer = (httpServer: HttpServer) => {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: [process.env.CLIENT_URL || "http://localhost:5173", "http://localhost:3000"],
      methods: ["GET", "POST"]
    }
  });

  io.use(async (socket, next) => {
    // TODO: Proper authentication - this is a placeholder
    // In a real app, you'd verify a token or session here
    // For now, we'll simulate fetching user info if a userId query param is passed
    const tempUserId = socket.handshake.auth.userId; // Prefer auth.userId first
    if (tempUserId && typeof tempUserId === 'string') {
      try {
        const user = await storage.getUser(tempUserId);
        if (user) {
          socket.data.userId = user.user_id;
          socket.data.displayName = user.profile?.display_name || user.email;
          console.log(`WebSocket User Authenticated: ${socket.data.displayName} (ID: ${socket.data.userId}) connected as socket ${socket.id}`);
          return next();
        } else {
          console.error(`WebSocket auth error: User not found for userId: ${tempUserId}`);
          return next(new Error('User not found for WebSocket authentication'));
        }
      } catch (error) {
        console.error('WebSocket auth error during user lookup:', error);
        return next(new Error('Authentication error during user lookup'));
      }
    } else {
        // If no userId is provided in auth, treat as an authentication error
        console.error('WebSocket auth error: No userId provided in handshake auth.');
        return next(new Error('Authentication error: No userId provided.'));
    }
  });

  io.on('connection', async (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    try {
      // socket.data.userId and socket.data.displayName are now guaranteed by the strict middleware
      const userId = socket.data.userId;
      const displayName = socket.data.displayName;

      console.log(`[WebSocket] User connected: ${displayName} (ID: ${userId}), Socket ID: ${socket.id}`);
      
      // Register this socket for the user
      registerUserSocket(userId, socket.id);
      
      // Automatically join user to their personal room for notifications
      // This allows sending direct notifications to a user across all their connections
      const userRoom = `user_${userId}`;
      socket.join(userRoom);
      console.log(`[WebSocket] User ${userId} (Socket ${socket.id}) automatically joined personal room: ${userRoom}`);
      
      // Get all active chat rooms for this user and join them automatically
      try {
        const userRooms = await storage.getChatRooms(userId);
        if (userRooms && userRooms.length > 0) {
          for (const room of userRooms) {
            if (room.chat_room_id) {
              socket.join(room.chat_room_id);
              console.log(`[WebSocket] User ${userId} (Socket ${socket.id}) automatically joined room: ${room.chat_room_id}`);
            }
          }
        }
      } catch (error) {
        console.error(`[WebSocket] Error auto-joining rooms for user ${userId}:`, error);
      }
      
      // Join rooms when requested by client
      socket.on('joinRoom', async (roomId) => {
        if (!roomId) return;
        
        try {
          // Save in an array of connected users for later use
          const userId = socket.data.userId;
          const displayName = socket.data.displayName;
          
          if (roomId.startsWith('user_')) {
            // Handle joining a user's personal notification room
            // These rooms are used for notifications and follow the format 'user_[userId]'
            console.log(`[WebSocket] User ${displayName} (ID: ${userId}) joined personal room: ${roomId}`);
            socket.join(roomId);
            
            // Register this socket for direct messaging to the user
            registerUserSocket(userId, socket.id);
          } else {
            // For regular chat rooms, verify membership before joining
            try {
              const isMember = await storage.isUserChatRoomMember(roomId, userId);
              
              if (isMember) {
                // Track the room membership with the socket's active rooms
                socket.join(roomId);
                console.log(`[WebSocket] User ${userId} (Socket ${socket.id}) joined room: ${roomId}`);
                
                // Auto-join the user's personal notification room if it's not already joined
                const userRoom = `user_${userId}`;
                const rooms = Array.from(socket.rooms || []);
                if (!rooms.includes(userRoom)) {
                  socket.join(userRoom);
                  console.log(`[WebSocket] User ${displayName} (ID: ${userId}) automatically joined room: ${roomId}`);
                }
              } else {
                console.log(`[WebSocket] User ${userId} denied access to room ${roomId}: Not a member`);
              }
            } catch (err) {
              console.error(`Error checking room membership for ${userId} in room ${roomId}:`, err);
            }
          }
        } catch (error) {
          console.error('Error in joinRoom handler:', error);
        }
      });

      // Leave rooms when requested by client
      socket.on('leaveRoom', (roomId) => {
        if (!roomId) {
          console.log(`[WebSocket] Client ${socket.id} attempted to leave room with null/empty roomId`);
          return;
        }
        
        console.log(`[WebSocket] User ${userId} (Socket ${socket.id}) leaving room: ${roomId}`);
        socket.leave(roomId);
      });
      
      // Handle disconnection
      socket.on('disconnecting', () => {
        console.log(`[WebSocket] User ${userId} (Socket ${socket.id}) disconnecting`);
      });

      socket.on('disconnect', () => {
        console.log(`[WebSocket] User ${userId} (Socket ${socket.id}) disconnected`);
        // Unregister this socket when the user disconnects
        unregisterUserSocket(userId, socket.id);
      });

      socket.on('sendMessage', async (data) => {
        const { roomId, content } = data;
        const userId = socket.data.userId;
        const displayName = socket.data.displayName;

        console.log(`'sendMessage' event received from user: ${displayName} (ID: ${userId}) for room: ${roomId} with content: "${content.substring(0,50)}..."`);

        if (!userId || userId.startsWith('guest-')) {
          console.error('Cannot process sendMessage: User not authenticated.');
          // Optionally, emit an error back to the sender
          // socket.emit('error', { message: "Authentication required to send messages." });
          return;
        }

        if (!roomId || !content) {
          console.error('Cannot process sendMessage: Missing roomId or content.');
          // Optionally, emit an error back to the sender
          // socket.emit('error', { message: "Room ID and message content are required." });
          return;
        }

        try {
          // First check if this is a direct message and determine recipient
          let recipientId = null;
          try {
            // Get information about the room to check if it's direct (type 'profile')
            const roomMembers = await storage.getChatRoomMembers(roomId);
            const roomInfo = await db.select()
              .from(chat_rooms)
              .where(eq(chat_rooms.chat_room_id, roomId))
              .limit(1);
              
            if (roomInfo.length > 0 && roomInfo[0].parent_type === 'profile') {
              // This is a direct message, find the other user to set as recipient
              const otherMember = roomMembers.find(member => member.user_id !== userId);
              if (otherMember) {
                recipientId = otherMember.user_id;
                console.log(`Direct message detected, setting recipient_id to ${recipientId}`);
              }
            }
          } catch (err) {
            console.error('Error determining recipient for message:', err);
            // Continue without recipient_id if we can't determine it
          }

          // 1. Save the message to the database
          const savedMessage = await storage.createChatMessage({
            chat_room_id: roomId,
            sender_id: userId,
            recipient_id: recipientId, // Add recipient_id (will be null for group chats)
            body: content,
            message_type: 'text'
          });
          console.log('Message saved to DB:', savedMessage);

          // 2. Broadcast the new message to all clients in that specific roomId
          // The payload should include the full message object with sender details
          // (sender details might need to be fetched or enriched if not returned by createChatMessage)
          // For now, assuming savedMessage contains necessary details or we augment it.
          const richSenderInfo = savedMessage.sender; // Assuming savedMessage.sender exists and is structured
          
          const messageForBroadcast = {
            ...savedMessage, // Spread the original message, which includes its own sender object
            // Now, selectively build the sender object for broadcast to ensure critical fields and fallbacks
            sender: {
              user_id: richSenderInfo?.user_id || userId, // Fallback to userId from socket data if needed
              display_name: richSenderInfo?.profile?.display_name || richSenderInfo?.email || displayName || "User",
              avatar_url: richSenderInfo?.profile?.avatar_url, // Include avatar if available
              // Copy other relevant fields from richSenderInfo or richSenderInfo.profile if necessary
              // For example: richSenderInfo.user_type, richSenderInfo.user_level etc.
            }
          };

          console.log(`Attempting to broadcast 'newMessage' to room: ${roomId}`);
          const socketsInRoom = await io.in(roomId).fetchSockets();
          if (socketsInRoom && socketsInRoom.length > 0) {
              console.log(`[SERVER DEBUG] Sockets in room ${roomId} before emit:`, socketsInRoom.map(s => ({ id: s.id, userId: s.data.userId })));
          } else {
              console.log(`[SERVER DEBUG] No sockets found in room ${roomId} for broadcast (checked before emit).`);
          }
          // First emit to the room
          io.to(roomId).emit('newMessage', messageForBroadcast);
          console.log(`'newMessage' event broadcasted to room ${roomId} with message ID ${messageForBroadcast.message_id}`);

          // Check if any sockets actually received the broadcast
          const socketsInRoomForBroadcast = await io.in(roomId).fetchSockets();
          console.log(`Sockets in room ${roomId} that should have received broadcast: ${socketsInRoomForBroadcast.length}`);
          
          // As a fallback, emit directly to all sockets of each member in the room for redundancy
          const roomMembersForDirectMessage = await storage.getChatRoomMembers(roomId) || [];
          console.log(`Room ${roomId} has ${roomMembersForDirectMessage.length} members, sending direct socket messages to each`);
          
          for (const member of roomMembersForDirectMessage) {
            // Get all sockets for this user
            const memberSocketIds = getSocketIdsForUser(member.user_id);
            
            if (memberSocketIds.length > 0) {
              console.log(`Found ${memberSocketIds.length} active sockets for user ${member.user_id}`);
              
              // Send the message directly to each socket
              for (const socketId of memberSocketIds) {
                io.to(socketId).emit('newMessage', messageForBroadcast);
              }
              console.log(`Direct 'newMessage' event sent to ${memberSocketIds.length} sockets for user ${member.user_id}`);
            } else {
              console.log(`No active sockets found for user ${member.user_id}`);
            }
          }

          // 3. Handle unread notifications
          //    Identify recipient(s) in the room. If it's a DM, the recipient is the other user.
          //    For each recipient who is *not* the sender, emit the 'newNotification' event 
          //    AND persist a notification in the database.

          const roomMembers = await storage.getChatRoomMembers(roomId); // Assumes this function exists
          if (roomMembers) {
            for (const member of roomMembersForDirectMessage) {
              if (member.user_id !== userId) { // Don't notify the sender
                // Use the user's personal notification room with consistent naming
                const recipientUserRoom = `user_${member.user_id}`;
                
                // Log active sockets for this recipient for debugging
                const recipientSockets = getSocketIdsForUser(member.user_id);
                console.log(`[WebSocket] Sending notification to user ${member.user_id}. Active sockets: ${recipientSockets.length}`);
                
                // Emit to the recipient's personal room which all their sockets have joined
                io.to(recipientUserRoom).emit('newNotification', { 
                  senderId: userId, 
                  roomId: roomId,
                  message: messageForBroadcast // Send the full message with the notification
                });
                
                // Don't emit the message again - it was already emitted to the room above
                // io.to(roomId).emit('newMessage', messageForBroadcast); // This line is removed to avoid duplicate messages
                
                // Send direct notifications to each socket for redundancy
                for (const socketId of recipientSockets) {
                  io.to(socketId).emit('newNotification', {
                    senderId: userId,
                    roomId: roomId,
                    message: messageForBroadcast
                  });
                }
                
                console.log(`'newNotification' event emitted to user ${member.user_id} for room ${roomId}`);

                // Persist notification in the database
                await storage.createNotification({
                  recipient_user_id: member.user_id,
                  actor_user_id: userId,
                  event_type: 'message_sent',
                  entity_id: roomId,
                  entity_type: 'chat_message',
                });
                console.log(`Notification persisted for user ${member.user_id} from sender ${userId} in room ${roomId}`);
              }
            }
          }

        } catch (error) {
          console.error('Error processing sendMessage:', error);
          // Optionally, emit an error back to the sender
          // socket.emit('error', { message: "Failed to send message. Please try again." });
        }
      });

      // Add a listener for markRoomMessagesAsRead route to handle the WebSocket part of it
      socket.on('markMessagesAsRead', async (data: { roomId: string }) => {
        try {
          const roomId = data.roomId;
          const userId = socket.data.userId;
          
          console.log(`User ${userId} marked messages as read in room ${roomId}`);
          
          // We'll broadcast to all *other* members of the room (senders of messages) 
          // that their messages have been read by this user
          const roomMembers = await storage.getChatRoomMembers(roomId);
          if (roomMembers) {
            // Get all messages in the room that were sent to this user
            const recentMessages = await storage.getChatRoomMessages(roomId, userId, 50, 0);
            
            // For each sender, update their messages' read status
            const senderIds = Array.from(
              new Set(recentMessages
                .filter(msg => msg.sender_id !== userId) // Only include messages not from current user
                .map(msg => msg.sender_id))
            );
            
            // Broadcast to each sender that their messages were read
            for (const senderId of senderIds) {
              // Update their messages to show as read
              const updatedMessages = recentMessages
                .filter(msg => msg.sender_id === senderId)
                .map(msg => ({
                  ...msg,
                  is_read: true // Mark as read
                }));
              
              // Notify the original sender that their message(s) have been read
              io.to(senderId).emit('messagesRead', {
                readByUserId: userId,
                roomId: roomId,
                messages: updatedMessages
              });
              
              console.log(`Notified sender ${senderId} that their messages in room ${roomId} were read by ${userId}`);
            }
          }
        } catch (error) {
          console.error('Error processing markMessagesAsRead:', error);
        }
      });

      socket.on('disconnect', () => {
        const userId = socket.data.userId; // Should be reliable from middleware
        const displayName = socket.data.displayName; // Should be reliable
        console.log(`[WebSocket] User ${displayName} (ID: ${userId}) disconnected from socket ID: ${socket.id}`);
      });

      // Join a room based on userId to allow direct targeting of sockets
      // This should use the guaranteed userId from socket.data
      if (userId && !userId.startsWith('guest-')) { // guest- check might be redundant if guests are rejected by middleware
        socket.join(userId);
        console.log(`[WebSocket] User ${displayName} (ID: ${userId}) joined personal room: ${userId}`);
      }

    } catch (error) {
      console.error('Error processing WebSocket connection:', error);
      socket.disconnect();
    }
  });
  
  console.log('WebSocket server initialized with basic auth and notification creation attempt');
  return io;
}; 