import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat'; // Path to your useChat hook
import MessageItem from './chat/message-item'; // Path to your MessageItem component
import { Paperclip, SendHorizonal, X, Loader2 } from 'lucide-react';
import { apiClient } from '../lib/apiClient'; // For calling mark-read API

interface Participant {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface ChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  roomId: string | null; // Room ID for the chat
  otherParticipant: Participant | null; // Details of the other user in a DM or group context
}

export const ChatPopup: React.FC<ChatPopupProps> = ({ 
  isOpen, 
  onClose, 
  currentUserId, 
  roomId, 
  otherParticipant 
}) => {
  const { messages, sendMessage, isConnected, isLoadingMessages, markMessagesAsRead: wsMarkMessagesAsRead } = useChat(currentUserId, roomId);
  const [inputText, setInputText] = useState('');
  const [isWindowFocused, setIsWindowFocused] = useState(document.hasFocus()); // Initialize with current focus state
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  // Media handling state - kept for UI, but not fully implemented in sendMessage yet
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]); 
  const fileInputRef = useRef<null | HTMLInputElement>(null);

  useEffect(() => {
    console.log('[ChatPopup DEBUG] Rendering / Re-rendering. isOpen:', isOpen, 'isLoadingMessages:', isLoadingMessages, 'Num messages:', messages.length, 'RoomID:', roomId);
  }); // No dependency array, logs on every render

  useEffect(() => {
    console.log('[ChatPopup DEBUG] Messages array instance changed. New length:', messages.length, 'RoomID:', roomId);
    // If messages.length > 0, log the last message's content and timestamp for checking
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log('[ChatPopup DEBUG] Last message content:', lastMsg.content, 'timestamp:', lastMsg.timestamp);
    }
  }, [messages, roomId]); // Log when the messages array reference changes

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Effect to track window focus/blur
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Set initial state based on document.hasFocus()
    setIsWindowFocused(document.hasFocus());

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const markMessagesAsRead = useCallback(async () => {
    if (!roomId || !currentUserId || !isWindowFocused) return; // Check isWindowFocused
    try {
      console.log(`Attempting to mark messages as read for room: ${roomId} (window focused: ${isWindowFocused})`);
      
      // Call both the API endpoint and WebSocket function to mark messages as read
      await apiClient.post(`/chat/rooms/${roomId}/mark-read`);
      wsMarkMessagesAsRead(); // Call the WebSocket markMessagesAsRead function
      
      console.log(`Successfully marked messages as read for room: ${roomId}`);
    } catch (error: any) {
      console.error('Failed to mark messages as read:', error);
      
      // Log more detailed error information to help with debugging
      if (error.response) {
        // The request was made and the server responded with a status code outside the 2xx range
        console.error('Error response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
      } else {
        // Something happened in setting up the request
        console.error('Request error:', error.message);
      }
      
      // Still try the WebSocket method if the API fails
      wsMarkMessagesAsRead();
    }
  }, [roomId, currentUserId, wsMarkMessagesAsRead, isWindowFocused]); // Add isWindowFocused to dependencies

  useEffect(() => {
    if (isOpen && roomId && isWindowFocused) { // Check isWindowFocused
      markMessagesAsRead();
    }
  }, [isOpen, roomId, markMessagesAsRead, isWindowFocused]); // Add isWindowFocused to dependencies

  // Mark as read when new messages arrive for the current open room
  useEffect(() => {
    if (isOpen && roomId && messages.length > 0 && isWindowFocused) { // Check isWindowFocused
      // Check if the last message is not from the current user and the chat is open
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && !lastMessage.isSender) {
        markMessagesAsRead();
      }
    }
  }, [messages, isOpen, roomId, markMessagesAsRead, isWindowFocused]); // Add isWindowFocused to dependencies


  const handleSendMessage = () => {
    if (!roomId) {
      console.error("Cannot send message, roomId is null");
      return;
    }
    if (inputText.trim() === '' /* && selectedMedia.length === 0 */) return; // Media sending not fully wired up yet
    
    sendMessage(inputText);
    setInputText('');
    setSelectedMedia([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMediaInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedMedia(Array.from(event.target.files));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen || !roomId || !otherParticipant) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white dark:bg-gray-800 shadow-xl rounded-lg flex flex-col border border-gray-300 dark:border-gray-700 z-50">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Chat with {otherParticipant.displayName}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <X size={20} />
        </button>
      </div>

      {!isConnected && (
        <div className="p-2 text-center bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200 text-sm">
          Connecting...
        </div>
      )}
      {isConnected && isLoadingMessages && (
         <div className="p-4 flex justify-center items-center flex-1 bg-gray-100 dark:bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="ml-2 text-gray-600 dark:text-gray-400">Loading messages...</p>
          </div>
      )}

      {!isLoadingMessages && (
        <div className="flex-1 p-4 overflow-y-auto space-y-1 bg-gray-100 dark:bg-gray-900">
          {messages.map((msg) => (
            <MessageItem key={msg.message_id} message={msg} currentUserId={currentUserId} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
      
      {selectedMedia.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-600 dark:text-gray-400">
          Selected: {selectedMedia.map(f => f.name).join(', ')}
          <button onClick={() => setSelectedMedia([])} className="ml-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">(Clear)</button>
        </div>
      )}

      <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center bg-white dark:bg-gray-800 rounded-b-lg">
        <input type="file" multiple ref={fileInputRef} onChange={handleMediaInputChange} className="hidden" accept="image/*,video/*" />
        <button onClick={triggerFileInput} className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mr-2">
          <Paperclip size={22} />
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (handleSendMessage(), e.preventDefault())}
          placeholder="Type a message..."
          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          disabled={!isConnected || isLoadingMessages}
        />
        <button onClick={handleSendMessage} className="p-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ml-2" disabled={!isConnected || isLoadingMessages}>
          <SendHorizonal size={22} />
        </button>
      </div>
    </div>
  );
}; 