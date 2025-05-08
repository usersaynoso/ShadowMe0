import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

interface Client {
  ws: WebSocket;
  userId: string;
  isAlive: boolean;
  sessionRooms: Set<string>; // Track which shadow session rooms the client has joined
}

interface Message {
  type: string;
  payload: any;
}

export function setupWebSockets(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Map<string, Client>();
  // Map of sessionId -> Set of userIds who are in the session
  const sessionRooms = new Map<string, Set<string>>();
  
  // Set up heartbeat interval to detect stale connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = Array.from(clients.values()).find(c => c.ws === ws);
      
      if (client && !client.isAlive) {
        // User is offline now
        updateUserOnlineStatus(client.userId, false);
        
        // Remove user from all session rooms
        client.sessionRooms.forEach(sessionId => {
          leaveSessionRoom(client.userId, sessionId);
        });
        
        clients.delete(client.userId);
        return ws.terminate();
      }
      
      // Mark as inactive for next ping
      if (client) {
        client.isAlive = false;
      }
      
      ws.send(JSON.stringify({ type: 'ping' }));
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
  
  wss.on('connection', (ws, req) => {
    let userId: string | null = null;
    
    ws.on('message', async (data) => {
      try {
        const message: Message = JSON.parse(data.toString());
        
        // Handle different message types
        switch (message.type) {
          case 'auth':
            // Authenticate the user
            userId = message.payload.userId;
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            // Store client connection with empty session rooms set
            clients.set(userId, { 
              ws, 
              userId, 
              isAlive: true,
              sessionRooms: new Set()
            });
            
            // Update user's online status
            updateUserOnlineStatus(userId, true);
            
            // Send successful auth response
            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              payload: { userId } 
            }));
            break;
            
          case 'pong':
            // Update the client's alive status
            if (userId && clients.has(userId)) {
              const client = clients.get(userId)!;
              client.isAlive = true;
            }
            break;
            
          case 'join_shadow_session':
            // Handle joining a shadow session
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            const { sessionId } = message.payload;
            
            if (!sessionId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Session ID is required' } 
              }));
              return;
            }
            
            // Add user to session room
            joinSessionRoom(userId, sessionId);
            
            // Get current session info
            const sessionData = await storage.getShadowSession(sessionId);
            if (!sessionData) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Shadow session not found' } 
              }));
              return;
            }
            
            // Get user info
            const userData = await storage.getUserById(userId);
            const displayName = userData?.profile?.display_name || 'Unknown User';
            
            // Notify other participants that someone joined
            broadcastToSessionRoom(sessionId, userId, {
              type: 'participant_joined',
              payload: {
                userId,
                displayName,
                timestamp: new Date().toISOString()
              }
            });
            
            // Send current session state to the joining user
            if (clients.has(userId)) {
              const client = clients.get(userId)!;
              client.ws.send(JSON.stringify({
                type: 'session_state',
                payload: {
                  sessionId,
                  session: sessionData,
                  timestamp: new Date().toISOString()
                }
              }));
            }
            break;
            
          case 'leave_shadow_session':
            // Handle leaving a shadow session
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            const { sessionId: leaveSessionId } = message.payload;
            
            if (!leaveSessionId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Session ID is required' } 
              }));
              return;
            }
            
            // Remove user from session room
            leaveSessionRoom(userId, leaveSessionId);
            
            // Get user info
            const leavingUserData = await storage.getUserById(userId);
            const leavingDisplayName = leavingUserData?.profile?.display_name || 'Unknown User';
            
            // Notify other participants that someone left
            broadcastToSessionRoom(leaveSessionId, userId, {
              type: 'participant_left',
              payload: {
                userId,
                displayName: leavingDisplayName,
                timestamp: new Date().toISOString()
              }
            });
            break;
            
          case 'session_message':
            // Handle messages in shadow sessions
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            const { sessionId: messageSessionId, content } = message.payload;
            
            if (!messageSessionId || !content) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Session ID and message content are required' } 
              }));
              return;
            }
            
            // Verify user is in the session
            const client = clients.get(userId);
            if (!client || !client.sessionRooms.has(messageSessionId)) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'You must join the session to send messages' } 
              }));
              return;
            }
            
            // Get user info for the message
            const messageUserData = await storage.getUserById(userId);
            const messageSenderName = messageUserData?.profile?.display_name || 'Unknown User';
            
            // Store message in the database if needed
            // ... (you can add message persistence here)
            
            // Broadcast message to all users in the session
            broadcastToSessionRoom(messageSessionId, userId, {
              type: 'session_message',
              payload: {
                senderId: userId,
                senderName: messageSenderName,
                content,
                timestamp: new Date().toISOString()
              }
            });
            break;
            
          case 'media_shared':
            // Handle media being shared
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            const { sessionId: mediaSessionId, mediaUrl, mediaType } = message.payload;
            
            if (!mediaSessionId || !mediaUrl) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Session ID and media URL are required' } 
              }));
              return;
            }
            
            // Verify user is in the session
            const mediaClient = clients.get(userId);
            if (!mediaClient || !mediaClient.sessionRooms.has(mediaSessionId)) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'You must join the session to share media' } 
              }));
              return;
            }
            
            // Get user info for the media share
            const mediaUserData = await storage.getUserById(userId);
            const mediaSenderName = mediaUserData?.profile?.display_name || 'Unknown User';
            
            // Broadcast media to all users in the session
            broadcastToSessionRoom(mediaSessionId, userId, {
              type: 'session_media',
              payload: {
                id: Date.now().toString(), // Simple ID for now
                userId: userId,
                senderName: mediaSenderName,
                mediaUrl,
                mediaType: mediaType || 'image',
                timestamp: new Date().toISOString()
              }
            });
            break;
            
          case 'typing':
            // Broadcast typing indicator
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            const { sessionId: typingSessionId, isTyping } = message.payload;
            
            if (!typingSessionId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Session ID is required' } 
              }));
              return;
            }
            
            // Verify user is in the session
            const typingClient = clients.get(userId);
            if (!typingClient || !typingClient.sessionRooms.has(typingSessionId)) {
              return;
            }
            
            // Broadcast typing status to all users in the session
            broadcastToSessionRoom(typingSessionId, userId, {
              type: 'user_typing',
              payload: {
                userId,
                isTyping
              }
            });
            break;
            
          case 'chat_message':
            // Handle new chat message
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            const { roomId, text } = message.payload;
            
            if (!roomId || !text) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Room ID and message text are required' } 
              }));
              return;
            }
            
            // Save message to database
            const newMessage = await storage.createChatMessage({
              chat_room_id: roomId,
              sender_id: userId,
              body: text,
              message_type: 'text'
            });
            
            // Get room members
            const roomMembers = await storage.getChatRoomMembers(roomId);
            
            // Broadcast message to all connected room members
            roomMembers.forEach(member => {
              if (clients.has(member.user_id)) {
                const client = clients.get(member.user_id)!;
                client.ws.send(JSON.stringify({
                  type: 'new_message',
                  payload: {
                    message: newMessage
                  }
                }));
              }
            });
            break;
            
          default:
            ws.send(JSON.stringify({ 
              type: 'error', 
              payload: { message: 'Unknown message type' } 
            }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Invalid message format' } 
        }));
      }
    });
    
    ws.on('close', () => {
      if (userId && clients.has(userId)) {
        const client = clients.get(userId)!;
        
        // Update user's online status
        updateUserOnlineStatus(userId, false);
        
        // Remove user from all session rooms
        client.sessionRooms.forEach(sessionId => {
          leaveSessionRoom(userId!, sessionId);
        });
        
        // Remove client
        clients.delete(userId);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (userId && clients.has(userId)) {
        const client = clients.get(userId)!;
        
        // Update user's online status
        updateUserOnlineStatus(userId, false);
        
        // Remove user from all session rooms
        client.sessionRooms.forEach(sessionId => {
          leaveSessionRoom(userId!, sessionId);
        });
        
        // Remove client
        clients.delete(userId);
      }
    });
  });
  
  // Helper function to add a user to a session room
  function joinSessionRoom(userId: string, sessionId: string) {
    // Add sessionId to user's joined rooms
    if (clients.has(userId)) {
      const client = clients.get(userId)!;
      client.sessionRooms.add(sessionId);
    }
    
    // Add userId to session room
    if (!sessionRooms.has(sessionId)) {
      sessionRooms.set(sessionId, new Set<string>());
    }
    
    const room = sessionRooms.get(sessionId)!;
    room.add(userId);
  }
  
  // Helper function to remove a user from a session room
  function leaveSessionRoom(userId: string, sessionId: string) {
    // Remove sessionId from user's joined rooms
    if (clients.has(userId)) {
      const client = clients.get(userId)!;
      client.sessionRooms.delete(sessionId);
    }
    
    // Remove userId from session room
    if (sessionRooms.has(sessionId)) {
      const room = sessionRooms.get(sessionId)!;
      room.delete(userId);
      
      // Clean up empty rooms
      if (room.size === 0) {
        sessionRooms.delete(sessionId);
      }
    }
  }
  
  // Helper function to broadcast a message to all users in a session room
  function broadcastToSessionRoom(sessionId: string, senderId: string, message: any) {
    if (!sessionRooms.has(sessionId)) return;
    
    const room = sessionRooms.get(sessionId)!;
    
    room.forEach(userId => {
      if (userId !== senderId && clients.has(userId)) {
        const client = clients.get(userId)!;
        client.ws.send(JSON.stringify(message));
      }
    });
  }
  
  // Helper to update user's online status
  async function updateUserOnlineStatus(userId: string, isOnline: boolean) {
    try {
      await storage.updateUserOnlineStatus(userId, isOnline);
      
      // Get user's friends to notify them about status change
      const userFriends = await storage.getUserConnections(userId);
      
      // Broadcast status change to connected friends
      userFriends.forEach(friend => {
        if (clients.has(friend.user_id)) {
          const client = clients.get(friend.user_id)!;
          client.ws.send(JSON.stringify({
            type: 'friend_status_change',
            payload: {
              userId,
              isOnline
            }
          }));
        }
      });
    } catch (error) {
      console.error('Failed to update user online status:', error);
    }
  }
  
  return wss;
}
