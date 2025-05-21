import { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

// Get the socket server URL from environment variables
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

// Define socket event types
interface MessageSocketEvents {
  newNotification: (data: { senderId: string, roomId?: string, message?: any }) => void;
}

interface MessageNotificationBadgeProps {
  count?: number;
}

export const MessageNotificationBadge: FC<MessageNotificationBadgeProps> = ({ count: propCount }) => {
  const auth = useAuth();
  const socketRef = useRef<Socket<MessageSocketEvents, any> | null>(null);
  const [forceCount, setForceCount] = useState(0);
  
  // Get unread message counts from API
  const { data: unreadSendersMap = {}, isLoading, error, refetch } = useQuery<Record<string, number>>({
    queryKey: ['/api/notifications/unread-message-senders'],
    enabled: !!auth.user && propCount === undefined, // Only fetch if user is authenticated and count is not provided
  });
  
  // Calculate total unread count if not provided as a prop
  let totalUnreadCount = propCount !== undefined ? propCount : Object.values(unreadSendersMap).reduce((sum, count) => sum + count, 0);
  
  console.log(`[MessageNotificationBadge RENDER] propCount: ${propCount}, calculated totalUnreadCount: ${totalUnreadCount}, isLoading: ${isLoading}`);
  
  // Debug logs for message notification badge
  useEffect(() => {
    if (isLoading) {
      console.log('[MessageBadge] Loading unread message counts...');
    } else if (error) {
      console.error('[MessageBadge] Error fetching unread counts:', error);
    } else {
      console.log('[MessageBadge] Unread senders map:', unreadSendersMap);
      console.log('[MessageBadge] Total unread count:', totalUnreadCount);
    }
  }, [unreadSendersMap, totalUnreadCount, isLoading, error]);
  
  // Connect to WebSocket for real-time updates
  useEffect(() => {
    // If count is provided by props, this badge is a display-only component
    // and should not manage its own socket connection or data fetching.
    if (propCount !== undefined) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (!auth.user) return;

    const newSocket = io(SOCKET_SERVER_URL, {
      auth: { userId: auth.user.user_id },
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log(`MessageNotificationBadge connected to WebSocket with socket ID: ${newSocket.id}`);
    });

    newSocket.on('newNotification', (data) => {
      console.log('MessageNotificationBadge received notification:', data);
      if (data.message) {
        // Increment our force counter for temporary testing
        setForceCount(prev => prev + 1);
        // Refetch unread count when a new message notification arrives
        refetch();
      }
    });

    newSocket.on('messagesRead', () => {
      // Refetch when messages are marked as read
      refetch();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [auth.user, refetch, propCount]);

  // For testing, use our force counter if the API isn't returning real data
  if (totalUnreadCount === 0 && forceCount > 0 && propCount === undefined) {
    totalUnreadCount = forceCount;
    console.log(`[MessageNotificationBadge RENDER] Using forceCount, totalUnreadCount is now: ${totalUnreadCount}`);
  }

  // Don't render anything if no unread messages or still loading
  if (isLoading && propCount === undefined) {
    console.log('[MessageNotificationBadge RENDER] isLoading is true and propCount is undefined, returning null.');
    return null;
  }
  if (totalUnreadCount === 0) {
    console.log('[MessageNotificationBadge RENDER] totalUnreadCount is 0, returning null.');
    return null;
  }

  console.log('[MessageNotificationBadge RENDER] Rendering badge with count:', totalUnreadCount);
  return (
    <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
      {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
    </span>
  );
}; 