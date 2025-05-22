import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useLocation } from 'wouter'; // Changed from react-router-dom
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../hooks/use-auth'; // Corrected path
import { ChatPopup } from '../components/ChatPopup'; // To potentially open a chat
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'; // Shadcn UI
import { Button } from '../components/ui/button';
import { Loader2, MessageSquareText } from 'lucide-react';
import { MainLayout } from '../components/main-layout'; // Import MainLayout
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import io, { Socket } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

// Define the expected shape of a chat room object from the backend
interface ChatRoom {
  chat_room_id: string;
  type: 'direct' | 'group'; // or parent_type from schema
  name: string; // Display name (other user's name for DM, group title for group)
  avatarUrl?: string;
  lastMessage: {
    id: string | number;
    content: string;
    timestamp: string; // ISO string
    sender: {
      id: string;
      displayName: string;
    };
    isSender: boolean;
  } | null;
  unreadCount: number;
  otherParticipant?: { // For DMs
    user_id: string;
    display_name?: string;
    avatar_url?: string;
    email?: string;
  } | null;
  // lastActivity: number; // Already used for sorting on backend
}

// Define socket event types for message notifications
interface MessageSocketEvents {
  newNotification: (data: { senderId: string, roomId?: string, message?: any }) => void;
  messagesRead: (data?: { senderId?: string }) => void;
}

const MessagesPage: React.FC = () => {
  const { user } = useAuth(); // Get current user
  const [_, setLocation] = useLocation(); // Changed from useNavigate
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket<MessageSocketEvents, any> | null>(null);
  const queryClient = useQueryClient();

  // Add state for tracking unread counts locally
  const [localUnreadCounts, setLocalUnreadCounts] = useState<Record<string, number>>(() => {
    // Initialize from localStorage if available
    try {
      const saved = localStorage.getItem('unreadMessageCounts');
      const counts = saved ? JSON.parse(saved) : {};
      console.log('[MessagesPage] Loaded unread counts from localStorage:', counts);
      return counts;
    } catch (e) {
      console.error('[MessagesPage] Error loading unread counts from localStorage:', e);
      return {};
    }
  });
  
  // Listen for unreadCountsUpdated events (for test integration)
  useEffect(() => {
    const handleUnreadCountsUpdated = (event: CustomEvent<{unreadCounts: Record<string, number>}>) => {
      if (event.detail?.unreadCounts) {
        console.log('[MessagesPage] Received unreadCountsUpdated event:', event.detail.unreadCounts);
        setLocalUnreadCounts(event.detail.unreadCounts);
        
        // Also update localStorage
        try {
          localStorage.setItem('unreadMessageCounts', JSON.stringify(event.detail.unreadCounts));
        } catch (e) {
          console.error('[MessagesPage] Error saving unread counts to localStorage:', e);
        }
      }
    };
    
    // Add event listener with type assertion
    window.addEventListener('unreadCountsUpdated', handleUnreadCountsUpdated as EventListener);
    
    return () => {
      window.removeEventListener('unreadCountsUpdated', handleUnreadCountsUpdated as EventListener);
    };
  }, []);

  // State for managing the ChatPopup
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<any | null>(null); // Adjust type as per ChatPopup
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);
  
  // Define fetchChatRooms function before using it in useEffect
  const fetchChatRooms = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ChatRoom[]>('/chat/rooms');
      // Backend already sorts by lastActivity, so direct use
      if (Array.isArray(response)) {
        setChatRooms(response);
      } else if (response && Array.isArray((response as any).data)) {
        setChatRooms((response as any).data);
      } else {
        console.error('Unexpected response structure for chat rooms:', response);
        setChatRooms([]);
        setError('Failed to load conversations due to unexpected server response.');
      }
    } catch (err) {
      console.error('Failed to fetch chat rooms:', err);
      setError('Failed to load conversations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);
  
  // A silent version for background refreshes that won't show loading states
  const silentRefreshChatRooms = useCallback(async () => {
    if (!user) return;
    // Don't set loading state here - this is a silent refresh
    try {
      console.log('[MessagesPage] Performing silent background refresh');
      const response = await apiClient.get<ChatRoom[]>('/chat/rooms');
      
      // Only update if we get valid data
      if (Array.isArray(response)) {
        setChatRooms(response);
      } else if (response && Array.isArray((response as any).data)) {
        setChatRooms((response as any).data);
      } else {
        console.error('[MessagesPage] Silent refresh: Unexpected response structure:', response);
        // Don't clear existing data or show errors for silent refreshes
      }
    } catch (err) {
      console.error('[MessagesPage] Silent refresh failed:', err);
      // Don't show error UI for background refreshes
    }
    // No finally block to set isLoading=false since we never set it to true
  }, [user]);

  // Get unread message sender counts from the API
  const { data: unreadSendersMap = {} as Record<string, number>, refetch: refetchUnreadCounts } = useQuery<Record<string, number>>({
    queryKey: ['/api/notifications/unread-message-senders'],
    enabled: !!user, // Only fetch if user is authenticated
    staleTime: 10 * 1000, // Consider data stale after 10 seconds
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when the window gets focus
  });
  
  // Sync unread counts from API with localStorage
  useEffect(() => {
    if (Object.keys(unreadSendersMap).length > 0) {
      console.log('[MessagesPage] Syncing API unread counts to localStorage:', unreadSendersMap);
      
      try {
        // Get existing counts from localStorage
        const saved = localStorage.getItem('unreadMessageCounts');
        let storedCounts = saved ? JSON.parse(saved) : {};
        
        // Merge API counts with localStorage counts (API counts take precedence)
        const mergedCounts = { ...storedCounts, ...unreadSendersMap };
        
        // Save the merged counts back to localStorage
        localStorage.setItem('unreadMessageCounts', JSON.stringify(mergedCounts));
        
        // Update local state too
        setLocalUnreadCounts(mergedCounts);
      } catch (e) {
        console.error('[MessagesPage] Error syncing unread counts to localStorage:', e);
      }
    }
  }, [unreadSendersMap]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (!user) return;

    console.log('[MessagesPage] Setting up WebSocket connection...');
    const newSocket = io(SOCKET_SERVER_URL, {
      auth: { userId: user.user_id },
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log(`[MessagesPage] Connected to WebSocket with socket ID: ${newSocket.id}`);
    });

    newSocket.on('newNotification', (data) => {
      console.log('[MessagesPage] Received notification:', data);
      const senderId = data.senderId;
      const roomId = data.roomId;
      const message = data.message;
      
      // Update local unread counts
      if (senderId) {
        setLocalUnreadCounts(prev => {
          const newCount = (prev[senderId] || 0) + 1;
          console.log(`[MessagesPage] Updating local unread count for sender ${senderId} to ${newCount}`);
          return {
            ...prev,
            [senderId]: newCount
          };
        });
        
        // If the chat with this person is open, mark as read immediately
        if (isChatPopupOpen && selectedParticipant && data.senderId === selectedParticipant.id) {
          console.log(`[MessagesPage] Chat is open, marking messages as read immediately`);
          apiClient.post(`/chat/rooms/${selectedRoomId}/mark-read`).catch(console.error);
          
          // Reset unread count for this sender
          setLocalUnreadCounts(prev => ({
            ...prev,
            [selectedParticipant.id]: 0
          }));
          
          // Update localStorage
          try {
            const saved = localStorage.getItem('unreadMessageCounts');
            const counts = saved ? JSON.parse(saved) : {};
            counts[selectedParticipant.id] = 0;
            localStorage.setItem('unreadMessageCounts', JSON.stringify(counts));
          } catch (e) {
            console.error('[MessagesPage] Error updating localStorage:', e);
          }
        } else {
          // Update chat rooms optimistically instead of refetching
          setChatRooms(prevRooms => {
            // Find the room that matches this sender
            return prevRooms.map(room => {
              // For direct messages, check if this is the room for this sender
              if (room.type === 'direct' && 
                  room.otherParticipant && 
                  room.otherParticipant.user_id === senderId) {
                
                // Create updated room with incremented unread count
                return {
                  ...room,
                  unreadCount: (room.unreadCount || 0) + 1,
                  // Update last message if we have message data
                  ...(message && {
                    lastMessage: {
                      id: message.id || Date.now().toString(),
                      content: message.content || 'New message',
                      timestamp: message.timestamp || new Date().toISOString(),
                      sender: {
                        id: senderId,
                        displayName: room.otherParticipant.display_name || 'User'
                      },
                      isSender: false
                    }
                  })
                };
              }
              
              // For rooms with matching roomId (useful for group chats)
              if (roomId && room.chat_room_id === roomId) {
                return {
                  ...room,
                  unreadCount: (room.unreadCount || 0) + 1,
                  // Update last message if we have message data
                  ...(message && {
                    lastMessage: {
                      id: message.id || Date.now().toString(),
                      content: message.content || 'New message',
                      timestamp: message.timestamp || new Date().toISOString(),
                      sender: {
                        id: senderId,
                        displayName: 'User' // We might not know the display name here
                      },
                      isSender: false
                    }
                  })
                };
              }
              
              return room;
            });
          });
        }
      }
      
      // Invalidate the unread senders query in the background
      // This will ensure data is eventually consistent without disrupting the UI
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-message-senders'] });
      
      // Schedule a silent background fetch for eventual consistency
      // This uses the silentRefreshChatRooms which won't trigger loading states
      setTimeout(() => {
        silentRefreshChatRooms();
      }, 2000); // Delay by 2 seconds to prevent UI disruption
    });

    newSocket.on('messagesRead', (data) => {
      console.log('[MessagesPage] Messages read event received:', data);
      
      if (data && data.senderId) {
        // Reset unread count for specific sender
        setLocalUnreadCounts(prev => ({
          ...prev,
          [data.senderId]: 0
        }));
        
        // Update localStorage
        try {
          const saved = localStorage.getItem('unreadMessageCounts');
          const counts = saved ? JSON.parse(saved) : {};
          counts[data.senderId] = 0;
          localStorage.setItem('unreadMessageCounts', JSON.stringify(counts));
        } catch (e) {
          console.error('[MessagesPage] Error updating localStorage:', e);
        }
      }
      
      // Refetch unread counts and chat rooms
      refetchUnreadCounts();
      fetchChatRooms();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, isChatPopupOpen, selectedParticipant, selectedRoomId, fetchChatRooms, refetchUnreadCounts, queryClient]);

  // fetchChatRooms is defined above

  useEffect(() => {
    fetchChatRooms();
  }, [fetchChatRooms]);

  const handleConversationClick = (room: ChatRoom) => {
    // For DMs, the 'otherParticipant' object should be directly available
    // For group chats, this might be simpler (just room_id, name, avatar)
    const participantForPopup = room.type === 'direct' && room.otherParticipant 
      ? { 
          id: room.otherParticipant.user_id, 
          displayName: room.otherParticipant.display_name || room.otherParticipant.email || 'User',
          avatarUrl: room.otherParticipant.avatar_url 
        }
      : {
          id: room.chat_room_id, // For group, use room_id as identifier
          displayName: room.name,
          avatarUrl: room.avatarUrl
      };

    setSelectedRoomId(room.chat_room_id);
    setSelectedParticipant(participantForPopup);
    setIsChatPopupOpen(true);
    
    // Mark messages as read when opening the chat
    if (room.unreadCount > 0) {
      // Call API to mark messages as read
      apiClient.post(`/chat/rooms/${room.chat_room_id}/mark-read`).catch(console.error);
      
      // Update local state optimistically
      setChatRooms(prevRooms => 
        prevRooms.map(r => 
          r.chat_room_id === room.chat_room_id ? { ...r, unreadCount: 0 } : r
        )
      );
      
      // Also update our local unread counts tracking
      if (room.type === 'direct' && room.otherParticipant) {
        const senderId = room.otherParticipant.user_id;
        
        // Update local state
        setLocalUnreadCounts(prev => ({
          ...prev,
          [senderId]: 0
        }));
        
        // Update localStorage
        try {
          const saved = localStorage.getItem('unreadMessageCounts');
          const counts = saved ? JSON.parse(saved) : {};
          counts[senderId] = 0;
          localStorage.setItem('unreadMessageCounts', JSON.stringify(counts));
        } catch (e) {
          console.error('[MessagesPage] Error updating localStorage:', e);
        }
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-message-senders'] });
      }
    }
  };

  const closeChatPopup = () => {
    setIsChatPopupOpen(false);
    setSelectedRoomId(null);
    setSelectedParticipant(null);
    // Refetch rooms after closing to refresh any unread status changes
    fetchChatRooms();
    // Also refetch unread counts
    refetchUnreadCounts();
  };
  
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };


  // Content for loading state
  const loadingContent = (
    <div className="flex justify-center items-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="ml-2">Loading conversations...</p>
    </div>
  );

  // Content for error state
  const errorContent = (
    <div className="flex flex-col justify-center items-center h-full text-red-500">
      <MessageSquareText className="h-12 w-12 mb-4" />
      <p>{error}</p>
      <Button onClick={fetchChatRooms} className="mt-4">Try Again</Button>
    </div>
  );

  // Content for not logged in state
  const notLoggedInContent = (
    <div className="flex flex-col justify-center items-center h-full">
      <MessageSquareText className="h-12 w-12 mb-4 text-gray-400" />
      <p className="text-lg text-gray-600">Please log in to view your messages.</p>
      <Button onClick={() => setLocation('/auth')} className="mt-4">Login</Button>
    </div>
  );

  // Content for empty chats state
  const emptyChatsContent = (
    <div className="flex flex-col justify-center items-center h-full">
      <MessageSquareText className="h-12 w-12 mb-4 text-gray-400" />
      <p className="text-lg text-gray-600">No conversations yet.</p>
      <p className="text-sm text-gray-500">Start a new chat to see it here.</p>
      {/* Optional: Button to start a new chat, e.g., by finding a user */}
    </div>
  );

  // Determine which content to show
  let pageContent;
  if (isLoading) {
    pageContent = loadingContent;
  } else if (error) {
    pageContent = errorContent;
  } else if (!user) {
    pageContent = notLoggedInContent;
  } else if (chatRooms.length === 0) {
    pageContent = emptyChatsContent;
  } else {
    pageContent = (
      <>
        <h1 className="text-2xl font-semibold mb-6">Messages</h1>
        <div className="bg-white shadow rounded-lg">
          <ul>
            {chatRooms.map((room) => {
              // Compute the actual unread count from both API data and localStorage
              // For direct messages, check if we have unread messages from this user
              let effectiveUnreadCount = room.unreadCount || 0;
              
              // For direct messages, also check our local unread counts from localStorage
              if (room.type === 'direct' && room.otherParticipant) {
                const senderId = room.otherParticipant.user_id;
                const localCount = localUnreadCounts[senderId] || 0;
                
                // Use the higher of the two counts
                effectiveUnreadCount = Math.max(effectiveUnreadCount, localCount);
                
                // Update the room object for consistent handling
                if (effectiveUnreadCount > room.unreadCount) {
                  room.unreadCount = effectiveUnreadCount;
                }
              }
              
              return (
                <li
                  key={room.chat_room_id}
                  className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  onClick={() => handleConversationClick(room)}
                  data-room-id={room.chat_room_id}
                  data-has-unread={effectiveUnreadCount > 0 ? 'true' : 'false'}
                >
                  <Avatar className="h-12 w-12 mr-4">
                    <AvatarImage src={room.avatarUrl} alt={room.name} />
                    <AvatarFallback>{room.name?.substring(0, 2).toUpperCase() || '??'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-md font-semibold truncate text-gray-800">{room.name}</p>
                      {room.lastMessage && (
                        <p className="text-xs text-gray-500">{formatTimestamp(room.lastMessage.timestamp)}</p>
                      )}
                    </div>
                    {room.lastMessage ? (
                      <p className="text-sm text-gray-600 truncate">
                        {room.lastMessage.isSender && "You: "}
                        {room.lastMessage.content}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No messages yet</p>
                    )}
                  </div>
                  {effectiveUnreadCount > 0 && (
                    <div className="ml-4 flex-shrink-0">
                      <span 
                        data-testid="chat-unread-badge"
                        className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full"
                        aria-label={`${effectiveUnreadCount} unread messages`}
                      >
                        {effectiveUnreadCount}
                      </span>
                    </div>
                  )}
                  {/* Always include a test element for debugging */}
                  <div 
                    data-testid="chat-room-debug" 
                    data-unread-count={effectiveUnreadCount}
                    data-room-id={room.chat_room_id}
                    data-user-id={room.type === 'direct' && room.otherParticipant ? room.otherParticipant.user_id : 'group'} 
                    className="hidden"
                  >
                    Room: {room.name}, Unread: {effectiveUnreadCount}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </>
    );
  }

  return (
    <MainLayout showLeftSidebar={true} showRightSidebar={true}>
      <div className="p-2">
        {pageContent}
      </div>

      {user && selectedRoomId && isChatPopupOpen && (
        <ChatPopup
          isOpen={isChatPopupOpen}
          onClose={closeChatPopup}
          currentUserId={user.user_id} 
          roomId={selectedRoomId}
          otherParticipant={selectedParticipant}
        />
      )}
    </MainLayout>
  );
};

export default MessagesPage; 