import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SessionMessage {
  type: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

interface UseShadowSessionWebSocketProps {
  sessionId: string;
}

export function useShadowSessionWebSocket({ sessionId }: UseShadowSessionWebSocketProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [isTyping, setIsTyping] = useState<{[key: string]: boolean}>({});
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  
  // Initialize WebSocket connection
  useEffect(() => {
    if (!user || !sessionId) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected for shadow session');
      setConnected(true);
      
      // Send authentication message
      ws.send(JSON.stringify({
        type: 'auth',
        payload: {
          userId: user.user_id
        }
      }));
      
      // Join the shadow session room
      ws.send(JSON.stringify({
        type: 'join_shadow_session',
        payload: {
          sessionId
        }
      }));
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected for shadow session');
      setConnected(false);
    };
    
    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      toast({
        title: "Connection Error",
        description: "Failed to connect to the shadow session.",
        variant: "destructive"
      });
      setConnected(false);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'session_message':
            setMessages(prev => [...prev, data.payload]);
            break;
            
          case 'participant_joined':
            // Update participants list
            setParticipants(prev => [...prev, data.payload.userId]);
            // Invalidate participants query
            queryClient.invalidateQueries({ 
              queryKey: ['/api/shadow-sessions', sessionId, 'participants'] 
            });
            break;
            
          case 'participant_left':
            // Update participants list
            setParticipants(prev => prev.filter(id => id !== data.payload.userId));
            // Invalidate participants query
            queryClient.invalidateQueries({ 
              queryKey: ['/api/shadow-sessions', sessionId, 'participants'] 
            });
            break;
            
          case 'user_typing':
            // Update typing status
            setIsTyping(prev => ({
              ...prev,
              [data.payload.userId]: data.payload.isTyping
            }));
            break;
          
          case 'session_update':
            // Invalidate shadow session data
            queryClient.invalidateQueries({ 
              queryKey: ['/api/shadow-sessions', sessionId] 
            });
            break;
            
          case 'ping':
            // Respond to server pings
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    setSocket(ws);
    
    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        // Leave the shadow session
        ws.send(JSON.stringify({
          type: 'leave_shadow_session',
          payload: {
            sessionId
          }
        }));
        ws.close();
      }
    };
  }, [user, sessionId, queryClient, toast]);
  
  // Function to send a message
  const sendMessage = useCallback((content: string) => {
    if (!socket || !connected || !user) return false;
    
    const message = {
      type: 'session_message',
      payload: {
        sessionId,
        content
      }
    };
    
    socket.send(JSON.stringify(message));
    return true;
  }, [socket, connected, sessionId, user]);
  
  // Function to send typing indicator
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!socket || !connected || !user) return;
    
    socket.send(JSON.stringify({
      type: 'typing',
      payload: {
        sessionId,
        isTyping
      }
    }));
  }, [socket, connected, sessionId, user]);
  
  return {
    connected,
    messages,
    participants,
    isTyping,
    sendMessage,
    sendTypingIndicator
  };
} 