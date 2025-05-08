import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Clock, MessageSquare, Image as ImageIcon } from "lucide-react";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { ShadowSessionMediaShare } from "./shadow-session-media-share";
import { User } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { useShadowSessionWebSocket } from "@/hooks/use-shadow-session-websocket";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface ShadowSessionChatProps {
  sessionId: string;
  isActive: boolean;
}

export function ShadowSessionChat({ sessionId, isActive }: ShadowSessionChatProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTypingTimeoutId, setIsTypingTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  // Get session participants
  const { data: participants = [] } = useQuery<User[]>({
    queryKey: ['/api/shadow-sessions', sessionId, 'participants'],
    enabled: !!sessionId,
  });
  
  // Connect to WebSocket for real-time chat
  const { 
    connected, 
    messages, 
    isTyping, 
    sendMessage, 
    sendTypingIndicator 
  } = useShadowSessionWebSocket({ sessionId });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && activeTab === "chat") {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Handle typing indicator
  const handleTyping = () => {
    sendTypingIndicator(true);
    
    // Clear previous timeout
    if (isTypingTimeoutId) {
      clearTimeout(isTypingTimeoutId);
    }
    
    // Set new timeout to stop "is typing" after 2 seconds of inactivity
    const timeoutId = setTimeout(() => {
      sendTypingIndicator(false);
    }, 2000);
    
    setIsTypingTimeoutId(timeoutId);
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!message.trim() || !connected || !isActive) return;
    
    setIsSending(true);
    
    // Send the message
    const success = sendMessage(message.trim());
    
    if (success) {
      setMessage('');
      // Clear typing indicator
      if (isTypingTimeoutId) {
        clearTimeout(isTypingTimeoutId);
        sendTypingIndicator(false);
      }
    }
    
    setIsSending(false);
  };
  
  // Handle Enter key to send message
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get user data by ID
  const getUserById = (userId: string): User | undefined => {
    return participants.find(p => p.user_id === userId);
  };
  
  // Create a fallback user when the real user is not available
  const createFallbackUser = (userId: string, displayName: string): User => ({
    user_id: userId,
    email: `${userId}@example.com`,
    user_type: "user",
    user_points: 0,
    user_level: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    profile: {
      display_name: displayName
    }
  });
  
  // Check who's typing
  const typingUsers = Object.entries(isTyping)
    .filter(([id, isTyping]) => isTyping && id !== user?.user_id)
    .map(([id]) => getUserById(id)?.profile?.display_name || "Someone");
  
  // Format timestamp
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), "h:mm a");
  };
  
  // Handle media share completion
  const handleMediaShared = () => {
    // Switch back to chat tab after sharing
    setActiveTab("chat");
  };
  
  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-6">
        <Clock className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-1">Session not active yet</h3>
        <p className="text-sm text-gray-500 text-center">
          The chat will be available when the session starts.
        </p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full border rounded-lg shadow-sm overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b">
          <TabsList className="w-full">
            <TabsTrigger value="chat" className="flex-1">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="media" className="flex-1">
              <ImageIcon className="h-4 w-4 mr-2" />
              Share Media
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="chat" className="flex-1 flex flex-col">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <p className="text-sm text-gray-500 mb-2">
                  No messages yet
                </p>
                <p className="text-xs text-gray-400">
                  Be the first to say something!
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isCurrentUser = msg.senderId === user?.user_id;
                  const sender = getUserById(msg.senderId);
                  
                  return (
                    <div 
                      key={index} 
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="flex max-w-[80%]">
                        {!isCurrentUser && (
                          <AvatarWithEmotion 
                            user={sender || createFallbackUser(msg.senderId, msg.senderName)}
                            size="sm"
                            className="mr-2 mt-1"
                          />
                        )}
                        
                        <div>
                          <div className="flex items-baseline mb-1">
                            {!isCurrentUser && (
                              <span className="text-sm font-medium mr-2">
                                {msg.senderName}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                          
                          <div 
                            className={`rounded-lg px-3 py-2 ${
                              isCurrentUser 
                                ? 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100' 
                                : 'bg-white dark:bg-gray-800 shadow-sm'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {typingUsers.length > 0 && (
                  <div className="flex items-center">
                    <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {typingUsers.length === 1 
                          ? `${typingUsers[0]} is typing...` 
                          : `${typingUsers.length} people are typing...`}
                      </span>
                      <span className="animate-pulse">...</span>
                    </div>
                  </div>
                )}
                
                {/* Dummy div for auto scroll */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          
          {/* Chat Input */}
          <div className="p-3 bg-white dark:bg-gray-800 border-t">
            <div className="flex space-x-2">
              <Textarea 
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="min-h-[60px] resize-none"
                disabled={!connected || isSending}
              />
              
              <Button 
                onClick={handleSendMessage}
                disabled={!message.trim() || !connected || isSending}
                className="self-end"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {!connected && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Connecting to session...
              </p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="media" className="p-4">
          <h3 className="text-lg font-medium mb-4">Share Images with the Session</h3>
          <ShadowSessionMediaShare 
            sessionId={sessionId} 
            onShare={handleMediaShared}
          />
          <div className="mt-4 text-xs text-gray-500">
            <p>Images shared here will be visible to all session participants.</p>
            <p>Supported formats: JPG, PNG, GIF (max 5MB)</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 