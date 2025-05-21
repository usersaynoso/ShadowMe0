import React, { useEffect } from 'react';
import { ChatMessage } from '../../hooks/useChat'; // Adjust path as needed

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string; // To help determine if the message is from the current user, though ChatMessage.isSender should be primary
}

const MessageItem: React.FC<MessageItemProps> = ({ message, currentUserId }) => {
  const { sender, content, timestamp, isSender, isRead, media } = message;

  // Debug log when component renders
  useEffect(() => {
    if (isSender) {
      console.log(`[MessageItem] Rendering message ${message.message_id}: isSender=${isSender}, isRead=${isRead}`);
    }
  }, [message, isSender, isRead]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Fallback for display name if profile info isn't fully populated yet
  const displayName = sender?.display_name || sender?.user_id || 'User'; 

  // Render media content
  const renderMedia = () => {
    if (!media || media.length === 0) return null;
    
    return (
      <div className="mt-2 space-y-2">
        {media.map((item, index) => (
          <div key={index} className="rounded-md overflow-hidden">
            {item.type === 'image' ? (
              <img 
                src={item.url} 
                alt="Shared image" 
                className="max-w-full max-h-[300px] object-contain" 
              />
            ) : item.type === 'video' ? (
              <video 
                src={item.url} 
                controls 
                className="max-w-full max-h-[300px]" 
                preload="metadata"
              />
            ) : null}
          </div>
        ))}
      </div>
    );
  };

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
          
          {/* Render media content */}
          {renderMedia()}
          
          <div className={`flex items-center justify-${isSender ? 'end' : 'start'} mt-1`}>
            <span className={`text-xs ${
              isSender 
                ? 'text-blue-200 dark:text-blue-300' 
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {formatTimestamp(timestamp)}
            </span>
            {isSender && (
              <span className={`ml-2 text-xs font-medium ${isRead ? 'text-green-300 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {isRead ? '✓ Read' : 'Sent'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageItem; 