import React from 'react';
import { ChatMessage } from '../../hooks/useChat'; // Adjust path as needed

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string; // To help determine if the message is from the current user, though ChatMessage.isSender should be primary
}

const MessageItem: React.FC<MessageItemProps> = ({ message, currentUserId }) => {
  const { sender, content, timestamp, isSender } = message;

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Fallback for display name if profile info isn't fully populated yet
  const displayName = sender?.display_name || sender?.user_id || 'User'; 

  return (
    <div className={`flex mb-2 ${isSender ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-end max-w-[75%] ${isSender ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar (Placeholder) */}
        {!isSender && (
          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 mr-2 flex-shrink-0">
            {/* Placeholder for sender.avatar_url */}
            {sender?.avatar_url ? (
              <img src={sender.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-xs text-gray-600 dark:text-gray-300 flex items-center justify-center h-full">
                {displayName.substring(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        )}
        <div className={`p-3 rounded-lg shadow-sm ${
          isSender 
            ? 'bg-blue-500 text-white rounded-br-none' 
            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
        }`}>
          {!isSender && (
            <p className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">{displayName}</p>
          )}
          {content && <p className="text-sm whitespace-pre-wrap">{content}</p>}
          {/* Media rendering would go here if ChatMessage included processed media URLs */}
          <p className={`text-xs mt-1 ${
            isSender 
              ? 'text-blue-200 dark:text-blue-300' 
              : 'text-gray-500 dark:text-gray-400'
          } ${isSender ? 'text-right' : 'text-left'}`}>
            {formatTimestamp(timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MessageItem; 