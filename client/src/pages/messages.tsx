import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'wouter'; // Changed from react-router-dom
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../hooks/use-auth'; // Corrected path
import { ChatPopup } from '../components/ChatPopup'; // To potentially open a chat
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'; // Shadcn UI
import { Button } from '../components/ui/button';
import { Loader2, MessageSquareText } from 'lucide-react';

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

const MessagesPage: React.FC = () => {
  const { user } = useAuth(); // Get current user
  const [_, setLocation] = useLocation(); // Changed from useNavigate
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for managing the ChatPopup
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<any | null>(null); // Adjust type as per ChatPopup
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);

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
    
    // Optionally, mark messages as read when opening the chat
    // This can also be done within ChatPopup/useChat when a room is active
    if (room.unreadCount > 0) {
      apiClient.post(`/chat/rooms/${room.chat_room_id}/mark-read`).catch(console.error);
      // Optimistically update UI or refetch rooms
      setChatRooms(prevRooms => 
        prevRooms.map(r => 
          r.chat_room_id === room.chat_room_id ? { ...r, unreadCount: 0 } : r
        )
      );
    }
  };

  const closeChatPopup = () => {
    setIsChatPopupOpen(false);
    setSelectedRoomId(null);
    setSelectedParticipant(null);
    // Potentially refetch rooms to update unread counts if ChatPopup doesn't handle it
    fetchChatRooms(); 
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


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-red-500">
        <MessageSquareText className="h-12 w-12 mb-4" />
        <p>{error}</p>
        <Button onClick={fetchChatRooms} className="mt-4">Try Again</Button>
      </div>
    );
  }

  if (!user) {
     return (
      <div className="flex flex-col justify-center items-center h-screen">
        <MessageSquareText className="h-12 w-12 mb-4 text-gray-400" />
        <p className="text-lg text-gray-600">Please log in to view your messages.</p>
        <Button onClick={() => setLocation('/auth')} className="mt-4">Login</Button>
      </div>
    );
  }
  
  if (chatRooms.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <MessageSquareText className="h-12 w-12 mb-4 text-gray-400" />
        <p className="text-lg text-gray-600">No conversations yet.</p>
        <p className="text-sm text-gray-500">Start a new chat to see it here.</p>
        {/* Optional: Button to start a new chat, e.g., by finding a user */}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-6">Messages</h1>
      <div className="bg-white shadow rounded-lg">
        <ul>
          {chatRooms.map((room) => (
            <li
              key={room.chat_room_id}
              className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
              onClick={() => handleConversationClick(room)}
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
              {room.unreadCount > 0 && (
                <div className="ml-4 flex-shrink-0">
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                    {room.unreadCount}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
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
    </div>
  );
};

export default MessagesPage; 