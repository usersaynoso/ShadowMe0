// This hook manages WebSocket connection, message state, and sending/receiving messages for a specific chat room.
import { useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { apiClient } from '../lib/apiClient';

// Define the shape of a message
export interface ChatMessage {
  message_id: number | string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
  };
  isSender: boolean;
  timestamp: Date;
  isRead?: boolean;
  media?: {
    url: string;
    type: string; // 'image' or 'video'
    thumbnailUrl?: string;
  }[];
}

// Define a type for the raw message from API/Socket
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
  is_read?: boolean;
  media?: {
    url: string;
    type: string;
    thumbnailUrl?: string;
  }[];
}

// Event interfaces
interface ServerToClientEvents {
  newMessage: (message: RawChatMessage) => void; 
  newNotification: (data: { senderId: string, roomId?: string, message?: any }) => void; 
  messagesRead: (data: { readByUserId: string, roomId: string, messages: any[] }) => void;
}

interface ClientToServerEvents {
  sendMessage: (data: { roomId: string; content: string; }) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  markMessagesAsRead: (data: { roomId: string }) => void;
}

// Socket server URL
let SOCKET_SERVER_URL = 'http://localhost:3000';

try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SOCKET_SERVER_URL) {
    SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL;
  }
} catch (error) {
  console.log('Using default Socket Server URL for tests or SSR');
}

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
        
        console.log(`Received ${response.length} messages from server`);
        
        const fetchedMessages = response.map((msg: RawChatMessage) => {
          return {
            message_id: msg.message_id,
            room_id: msg.chat_room_id,
            sender_id: msg.sender_id,
            content: msg.body,
            created_at: msg.created_at,
            timestamp: new Date(msg.created_at),
            isSender: msg.sender_id === currentUserId,
            isRead: msg.is_read || false,
            sender: msg.sender,
            media: msg.media
          } as ChatMessage;
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

  // WebSocket connection and event handling
  useEffect(() => {
    if (!roomId || !currentUserId) {
      if (socketRef.current) {
        console.log('Disconnecting socket due to missing roomId or userId');
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Initialize socket if not already connected
    if (!socketRef.current) {
      console.log(`Initializing new WebSocket connection for user ${currentUserId}`);
      const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_SERVER_URL, {
        auth: { userId: currentUserId },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });
      socketRef.current = socket;
    }

    const socket = socketRef.current;
    
    // Clear existing listeners to avoid duplicates
    socket.off('connect');
    socket.off('disconnect');
    socket.off('connect_error');
    socket.off('newMessage');
    socket.off('messagesRead');

    // Connection events
    socket.on('connect', () => {
      console.log(`User ${currentUserId} connected to WebSocket. Socket ID: ${socket.id}`);
      setIsConnected(true);
      
      // Join the user's personal notification room (matching server-side naming)
      const userRoom = `user_${currentUserId}`;
      console.log(`Joining user notification room: ${userRoom}`);
      socket.emit('joinRoom', userRoom);
      
      // Join the specific chat room
      console.log(`Joining chat room: ${roomId}`);
      socket.emit('joinRoom', roomId);
      
      // Mark messages as read when joining
      socket.emit('markMessagesAsRead', { roomId });
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log(`User ${currentUserId} disconnected from WebSocket. Reason: ${reason}`);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        console.log('Server disconnected socket. Attempting to reconnect...');
        socket.connect();
      }
    });

    // Message handling
    socket.on('newMessage', (message: RawChatMessage) => {
      if (message.chat_room_id === roomId) {
        console.log(`[WebSocket] Received message for room ${roomId} from user ${message.sender_id}`);

        const formattedMessage: ChatMessage = {
          message_id: message.message_id,
          room_id: message.chat_room_id,
          sender_id: message.sender_id,
          content: message.body,
          created_at: message.created_at,
          timestamp: new Date(message.created_at),
          isSender: message.sender_id === currentUserId,
          isRead: false,
          sender: message.sender,
          media: message.media
        };

        setMessages(prevMessages => {
          // Check if this message already exists (prevent duplicates)
          const messageExists = prevMessages.some(
            msg => msg.message_id === message.message_id
          );

          if (!messageExists) {
            return [...prevMessages, formattedMessage].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );
          }
          return prevMessages;
        });

        // If we received a message from someone else, mark it as read
        if (message.sender_id !== currentUserId) {
          socket.emit('markMessagesAsRead', { roomId });
        }
      } else {
        console.log(`[WebSocket] Received message for different room (${message.chat_room_id}), ignoring.`);  
      }
    });

    // Handle read status updates
    socket.on('messagesRead', (data: { readByUserId: string, roomId: string, messages: any[] }) => {
      console.log(`[WebSocket] Received messagesRead event for room ${data.roomId}`);
      
      if (data.roomId === roomId && data.messages && Array.isArray(data.messages)) {
        // Get the message IDs that have been read
        const readMessageIds = data.messages.map((msg: any) => msg.message_id);
        
        setMessages(prevMessages => 
          prevMessages.map(msg => {
            if (readMessageIds.includes(msg.message_id) && !msg.isRead) {
              return { ...msg, isRead: true };
            }
            return msg;
          })
        );
      } else {
        console.log(`[WebSocket] messagesRead event for different room, ignoring`);
      }
    });

    // Return cleanup function
    return () => {
      console.log(`Cleaning up WebSocket connection for room ${roomId}`);
      if (socketRef.current) {
        // Leave rooms when component unmounts or roomId changes
        if (roomId) socketRef.current.emit('leaveRoom', roomId);
        if (currentUserId) socketRef.current.emit('leaveRoom', `user_${currentUserId}`);
        
        // Disconnect the socket
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [currentUserId, roomId]);

  // Define the sendMessage function with improved reliability
  const sendMessage = useCallback(
    (content: string) => {
      if (!roomId || !content.trim()) {
        console.error("Cannot send message: missing roomId or content");
        return false;
      }

      // For optimistic UI updates, create a temporary message that will be displayed immediately
      const tempMessageId = `temp-${Date.now()}`;
      const tempMessage: ChatMessage = {
        message_id: tempMessageId,
        room_id: roomId,
        sender_id: currentUserId || '',
        content: content.trim(),
        created_at: new Date().toISOString(),
        timestamp: new Date(),
        isSender: true,
        isRead: false, // Initially mark as unread
        sender: { // Include minimal sender info for optimistic UI updates
          user_id: currentUserId || '',
          display_name: undefined,
          avatar_url: undefined,
        },
      };

      // Add optimistic message to state
      setMessages(prevMessages => [...prevMessages, tempMessage].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      ));
      
      // Check if socket is connected
      if (!socketRef.current) {
        console.error("Socket connection not established. Cannot send message.");
        return false;
      }
      
      // Make sure socket is connected and we're in the room
      if (!socketRef.current.connected) {
        console.log("Socket not connected. Connecting and will retry sending...");
        socketRef.current.connect();
        
        // Set up one-time listener for reconnection
        socketRef.current.once('connect', () => {
          console.log("Socket reconnected. Now joining room and sending message...");
          socketRef.current?.emit('joinRoom', roomId);
          setTimeout(() => {
            socketRef.current?.emit('sendMessage', { roomId, content: content.trim() });
          }, 100); // Small delay to ensure room join is processed
        });
      } else {
        // Socket is connected, make sure we're in the room
        console.log(`Ensuring we're in room ${roomId} before sending message`);
        socketRef.current.emit('joinRoom', roomId);
        
        // Small delay to ensure room join is processed
        setTimeout(() => {
          socketRef.current?.emit('sendMessage', { roomId, content: content.trim() });
          console.log(`Message sent to room ${roomId}: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`); 
        }, 100);
      }
      
      return true;
    },
    [roomId, currentUserId]
  );
  
  // Create a markMessagesAsRead function to expose
  const markMessagesAsRead = useCallback(() => {
    if (roomId && socketRef.current?.connected) {
      console.log(`Marking all messages as read in room ${roomId}`);
      socketRef.current.emit('markMessagesAsRead', { roomId });
    }
  }, [roomId]);

  return { messages, sendMessage, isConnected, isLoadingMessages, markMessagesAsRead };
};