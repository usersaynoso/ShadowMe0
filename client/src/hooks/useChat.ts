// This hook manages WebSocket connection, message state, and sending/receiving messages for a specific chat room.
import { useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { apiClient } from '../lib/apiClient'; // Assuming you have an apiClient

// Define the shape of a message (aligning with server's broadcasted message)
export interface ChatMessage {
  message_id: number | string; // Assuming message_id is present
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string; // Or Date
  sender: { // Sender details as broadcasted by server
    user_id: string;
    display_name?: string;
    avatar_url?: string;
  };
  isSender: boolean; // Determined on client-side
  timestamp: Date; // Could be redundant if created_at is a Date, or used for client-side sorting
  isRead?: boolean; // Added to track read status
  media?: {
    url: string;
    type: string; // 'image' or 'video'
    thumbnailUrl?: string;
  }[];
}

// Define a type for the raw message from API/Socket, before client-side processing
// This matches Omit<ChatMessage, 'isSender' | 'timestamp'> & { sender: ChatMessage['sender'] }
interface RawChatMessage {
  message_id: number | string;
  chat_room_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender: {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
  };
  is_read?: boolean; // Added to track read status from backend
  media?: {
    url: string;
    type: string;
    thumbnailUrl?: string;
  }[];
}

// Updated event interfaces to match server/websocket.ts more closely
interface ServerToClientEvents {
  newMessage: (message: RawChatMessage) => void; // Server sends raw message
  newNotification: (data: { senderId: string, roomId?: string, message?: any }) => void; // Keep for other notifications
  messagesRead: (data: { readByUserId: string, roomId: string, messages: any[] }) => void; // Add messagesRead event
  // We might need an error event from server if sendMessage fails for some reason
  // chatError: (data: { message: string }) => void;
}

interface ClientToServerEvents {
  sendMessage: (data: { roomId: string; content: string; }) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  markMessagesAsRead: (data: { roomId: string }) => void; // Add markMessagesAsRead event
}

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

export const useChat = (currentUserId: string | null, roomId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  // Fetch initial messages for the room
  useEffect(() => {
    if (!roomId || !currentUserId) {
      setMessages([]); // Clear messages if no room or user
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        console.log(`Fetching messages for room ${roomId}`);
        const response = await apiClient.get<RawChatMessage[]>(`/chat/rooms/${roomId}/messages`);
        
        if (!response || !Array.isArray(response)) {
          console.error('Invalid response format from server:', response);
          setMessages([]);
          setIsLoadingMessages(false);
          return;
        }
        
        console.log(`Received ${response.length} messages from server`, response);
        
        const fetchedMessages = response.map((msg: RawChatMessage): ChatMessage => {
          console.log('Raw created_at from fetch:', msg.created_at);
          return {
            message_id: msg.message_id,
            room_id: msg.chat_room_id,
            sender_id: msg.sender_id,
            content: msg.body,
            created_at: msg.created_at,
            sender: msg.sender,
            timestamp: new Date(msg.created_at),
            isSender: msg.sender_id === currentUserId,
            isRead: msg.is_read, // Assign isRead status
            media: msg.media, // Include media if present
          };
        });
        
        setMessages(fetchedMessages.sort((a: ChatMessage, b: ChatMessage) => a.timestamp.getTime() - b.timestamp.getTime()));
      } catch (error) {
        console.error('Failed to fetch chat messages:', error);
        setMessages([]); // Clear messages on error
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [roomId, currentUserId]);


  useEffect(() => {
    if (!roomId || !currentUserId) { // Ensure roomId is also present before connecting for a specific chat context
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Corrected Socket generic type arguments
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_SERVER_URL, {
      auth: { userId: currentUserId },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`User ${currentUserId} connected to WebSocket for room ${roomId}. Socket ID: ${socket.id}`);
      setIsConnected(true);
      // Join the specific chat room on connect
      socket.emit('joinRoom', roomId);
      // Mark messages as read when joining a room
      socket.emit('markMessagesAsRead', { roomId });
    });

    socket.on('disconnect', () => {
      console.log(`User ${currentUserId} disconnected from WebSocket for room ${roomId}`);
      setIsConnected(false);
    });

    // Listen for new messages specific to this room
    socket.on('newMessage', (message: RawChatMessage) => {
      console.log(`[WebSocket DEBUG] Received A message object on client:`, JSON.stringify(message));
      console.log(`[WebSocket DEBUG] Current client roomId for this hook instance: ${roomId}`);
      // Ensure the message is for the current room to avoid cross-talk if socket handles multiple rooms
      if (message.chat_room_id === roomId) { 
        console.log("[WebSocket] Received new message for current room (raw):", message); // message.body here
        console.log('[WebSocket] Raw created_at:', message.created_at);
        const receivedMessage: ChatMessage = {
          message_id: (message.message_id === undefined || message.message_id === null) ? `temp-${Date.now()}` : message.message_id,
          room_id: message.chat_room_id, 
          sender_id: message.sender_id,
          content: message.body, // MAP message.body to ChatMessage.content
          created_at: message.created_at,
          sender: message.sender, 
          timestamp: new Date(message.created_at),
          isSender: message.sender_id === currentUserId,
          isRead: message.is_read, // Assign isRead status for new messages
          media: message.media, // Include media if present
        };
        console.log("[WebSocket] Processed receivedMessage object with isRead:", receivedMessage.isRead);

        setMessages((prevMessages) => {
          console.log('[WebSocket PM Current ID]', receivedMessage.message_id, 'Content:', receivedMessage.content); 
          const existingMsgIndex = prevMessages.findIndex(m => {
            const isServerIdMatch = m.message_id === receivedMessage.message_id;
            const isTempMatch = typeof m.message_id === 'string' && 
                              m.message_id.startsWith('temp-') && 
                              m.content === receivedMessage.content && // Compare optimistic m.content with receivedMessage.content
                              m.sender_id === receivedMessage.sender_id &&
                              m.sender_id === currentUserId; 

            console.log(`[WebSocket findIndex] Checking m.id: "${m.message_id}" (isTemp: ${typeof m.message_id === 'string' && m.message_id.startsWith('temp-')}), m.content: "${m.content}" --- against received.id: "${receivedMessage.message_id}", received.content: "${receivedMessage.content}" --- Result: isServerIdMatch=${isServerIdMatch}, isTempMatch=${isTempMatch}`);
            return isServerIdMatch || isTempMatch;
          });

          let updatedMessages;
          if (existingMsgIndex !== -1) {
            console.log("[WebSocket] Updating existing message (possibly optimistic) with server version. ID:", receivedMessage.message_id);
            updatedMessages = [...prevMessages];
            updatedMessages[existingMsgIndex] = receivedMessage; // Replace with server confirmed message
          } else {
            // If findIndex didn't find it, it's considered a new message.
            // The previous `some` check here could prevent addition if findIndex missed an ID match;
            // simplifying to ensure "new" messages (per findIndex) are added.
            console.log("[WebSocket] Adding new message from server. Current count:", prevMessages.length);
            updatedMessages = [...prevMessages, receivedMessage];
          }

          console.log("[WebSocket] Updated messages count:", updatedMessages.length);
          return updatedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      } else {
        console.log("[WebSocket] Received message for a different room, ignoring. Msg room:", message.chat_room_id, "Current room:", roomId);
      }
    });
    
    // Listen for messagesRead event
    socket.on('messagesRead', (data) => {
      console.log(`[WebSocket] Received messagesRead event for roomId: ${data.roomId}, read by user: ${data.readByUserId}, affecting ${data.messages ? data.messages.length : 0} messages.`);
      if (data.messages) { // Add a check for data.messages existence
        console.log(`[WebSocket] Details of messages read:`, data.messages);
      }

      if (data.roomId === roomId) {
        setMessages((prevMessages) => {
          let changed = false;
          const updatedMessages = prevMessages.map(msg => {
            // Ensure data.messages is an array and msg.message_id is defined
            const messageInData = data.messages && Array.isArray(data.messages) && msg.message_id !== undefined ? 
                                  data.messages.find(m => m.message_id === msg.message_id) : 
                                  undefined;

            if (messageInData) {
              // Scenario 1: The current user has read these messages (affects unread count)
              // This includes messages sent by others TO the current user, and messages sent BY the current user (e.g., read on another device)
              if (data.readByUserId === currentUserId) {
                if (!msg.isRead) {
                  console.log(`[WebSocket] Marking message ${msg.message_id} as read for current user ${currentUserId}. Old isRead: ${msg.isRead}`);
                  changed = true;
                  return { ...msg, isRead: true };
                }
              }
              // Scenario 2: A message SENT BY the current user has been read by SOMEONE ELSE (for "seen by" indicators)
              // This check ensures msg.isSender and currentUserId match who sent it.
              else if (msg.isSender && msg.sender_id === currentUserId && data.readByUserId !== currentUserId) {
                 if (!msg.isRead) { 
                    console.log(`[WebSocket] Marking message ${msg.message_id} (sent by current user ${currentUserId}) as read by ${data.readByUserId}. Old isRead: ${msg.isRead}`);
                    changed = true;
                    return { ...msg, isRead: true }; // Mark as read, could be for "seen by" display
                }
              }
            }
            return msg; // Return original message if no changes
          });

          if (changed) {
            console.log(`[WebSocket] Read status updated for some messages. Triggering re-render.`);
            // Ensure sorting remains consistent after updates
            return updatedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          }
          
          // console.log(`[WebSocket] No messages needed read status update for this event, or data.readByUserId (${data.readByUserId}) did not match currentUserId (${currentUserId}) for received messages.`);
          return prevMessages; // No changes, return original array to avoid unnecessary re-render
        });
      } else {
        console.log(`[WebSocket] messagesRead event for different room (${data.roomId}), current room is ${roomId}. Ignoring.`);
      }
    });

    // TODO: Handle 'newNotification' if it's relevant for in-app chat behavior beyond global notifications
    // e.g., if a new message in *another* room should trigger something in the current chat context (unlikely for this hook)

    return () => {
      if (socketRef.current) {
        // Leave the room when the component/hook unmounts or roomId changes
        socketRef.current.emit('leaveRoom', roomId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [currentUserId, roomId]); // Re-run effect if roomId changes

  const sendMessage = useCallback(async (content: string, mediaFiles?: File[]) => {
    if (!currentUserId || !roomId || (content.trim() === '' && (!mediaFiles || mediaFiles.length === 0))) {
      console.warn('Cannot send message: missing user, room, or empty content with no media.');
      return;
    }
    if (!socketRef.current) {
        console.warn('Cannot send message: socket not connected.');
        // Optionally, queue the message or notify user of connection issue
        return;
    }

    // Optimistic update with temp ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: ChatMessage = {
      message_id: tempId, // Temporary ID
      room_id: roomId,
      sender_id: currentUserId,
      content: content.trim(),
      created_at: new Date().toISOString(), // Current time
      sender: { // Basic sender info for optimistic display
        user_id: currentUserId,
        // display_name: user?.profile?.display_name || "You", // Requires access to full user object
        // avatar_url: user?.profile?.avatar_url,
      },
      isSender: true,
      timestamp: new Date(),
      isRead: false, // Optimistically set to false for new messages
    };

    // Handle media files if provided
    if (mediaFiles && mediaFiles.length > 0) {
      try {
        // Create FormData object for upload
        const formData = new FormData();
        formData.append('roomId', roomId);
        formData.append('content', content.trim());
        
        // Attach all media files
        mediaFiles.forEach(file => {
          formData.append('media', file);
        });
        
        // Set temp media array for optimistic update
        optimisticMessage.media = mediaFiles.map(file => ({
          url: URL.createObjectURL(file),
          type: file.type.startsWith('image/') ? 'image' : 'video',
        }));
        
        // Add message to UI first (optimistic)
        setMessages((prevMessages) => 
          [...prevMessages, optimisticMessage].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        );
        
        // Send via API instead of socket for media uploads
        const response = await apiClient.post(`/chat/messages/media`, formData);
        console.log('Media message sent via API:', response);
        
        // Clean up object URLs
        if (optimisticMessage.media) {
          optimisticMessage.media.forEach(media => {
            if (media.url && media.url.startsWith('blob:')) {
              URL.revokeObjectURL(media.url);
            }
          });
        }
        
        return;
      } catch (error) {
        console.error('Failed to upload media:', error);
        // Continue with text-only message if media upload fails
      }
    }

    // For text-only messages, use socket
    setMessages((prevMessages) => 
      [...prevMessages, optimisticMessage].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    );

    // Emit to server
    socketRef.current.emit('sendMessage', { roomId, content: content.trim() });
    
  }, [roomId, currentUserId]); // Add currentUserId to dependencies if used for sender details

  // Add function to mark messages as read
  const markMessagesAsRead = useCallback(() => {
    if (!currentUserId || !roomId || !socketRef.current) {
      return;
    }
    
    console.log(`Marking messages as read in room ${roomId}`);
    socketRef.current.emit('markMessagesAsRead', { roomId });
  }, [currentUserId, roomId]);

  return { messages, sendMessage, isConnected, isLoadingMessages, markMessagesAsRead };
}; 