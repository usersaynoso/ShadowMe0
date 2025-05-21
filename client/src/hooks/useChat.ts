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
}

// Updated event interfaces to match server/websocket.ts more closely
interface ServerToClientEvents {
  newMessage: (message: RawChatMessage) => void; // Server sends raw message
  newNotification: (data: { senderId: string, roomId?: string, message?: any }) => void; // Keep for other notifications
  // We might need an error event from server if sendMessage fails for some reason
  // chatError: (data: { message: string }) => void;
}

interface ClientToServerEvents {
  sendMessage: (data: { roomId: string; content: string; }) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
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
    if (!currentUserId || !roomId) { // Ensure roomId is also present before connecting for a specific chat context
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
        };
        console.log("[WebSocket] Processed receivedMessage object (with .content):", receivedMessage);

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

  const sendMessage = useCallback((content: string) => {
    if (!currentUserId || !roomId || content.trim() === '') {
      console.warn('Cannot send message: missing user, room, or empty content.');
      return;
    }
    if (!socketRef.current) {
        console.warn('Cannot send message: socket not connected.');
        // Optionally, queue the message or notify user of connection issue
        return;
    }

    // Optimistic update
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
    };

    setMessages((prevMessages) => 
      [...prevMessages, optimisticMessage].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    );

    // Emit to server
    socketRef.current.emit('sendMessage', { roomId, content: content.trim() });
    
  }, [roomId, currentUserId]); // Add currentUserId to dependencies if used for sender details

  return { messages, sendMessage, isConnected, isLoadingMessages };
}; 