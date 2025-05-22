import { FC, useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, Sparkles, CalendarDays, UserCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageNotificationBadge } from "@/components/ui/message-notification-badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import io, { Socket } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

// Define socket event types
interface MessageSocketEvents {
  newNotification: (data: { senderId: string, roomId?: string, message?: any }) => void;
  messagesRead: () => void;
}

interface MobileNavigationProps {
  onMessagesClick: () => void;
}

export const MobileNavigation: FC<MobileNavigationProps> = ({ onMessagesClick }) => {
  const [location] = useLocation();
  const auth = useAuth();
  const socketRef = useRef<Socket<MessageSocketEvents, any> | null>(null);
  // Initialize forceCount from localStorage if available
  const [forceCount, setForceCount] = useState(() => {
    try {
      const savedCount = localStorage.getItem('unread_messages_force_count');
      return savedCount ? parseInt(savedCount, 10) : 0;
    } catch (e) {
      return 0;
    }
  });
  
  // Get unread message counts from API
  const { data: unreadSendersMap = {}, refetch, isLoading } = useQuery<Record<string, number>>({
    queryKey: ["/api/notifications/unread-message-senders"],
    enabled: !!auth.user,
    staleTime: 5 * 1000, // Consider data stale after 5 seconds
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
    // Add cache persistence to avoid badge disappearing on refresh
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    initialData: () => {
      // Try to use cached data from localStorage on initial load
      try {
        const cachedData = localStorage.getItem('cached_unread_messages');
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      } catch (error) {
        console.error("Error loading cached unread messages:", error);
      }
      return {};
    }
  });
  
  // Calculate total unread messages
  let totalUnreadCount = 0;
  
  // Handle edge cases (null or undefined data)
  if (unreadSendersMap && typeof unreadSendersMap === 'object') {
    totalUnreadCount = Object.values(unreadSendersMap).reduce((sum: number, count: number) => sum + (count || 0), 0);
  }
  
  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (!auth.user) return;
    
    // Create WebSocket connection
    const newSocket = io(SOCKET_SERVER_URL, {
      auth: { userId: auth.user.user_id },
    });
    socketRef.current = newSocket;
    
    newSocket.on('connect', () => {
      console.log(`[MobileNavigation] Connected to WebSocket with socket ID: ${newSocket.id}`);
    });
    
    newSocket.on('newNotification', (data) => {
      console.log('[MobileNavigation] Received notification:', data);
      if (data.message) {
        // Increment the counter for immediate feedback
        setForceCount(prev => prev + 1);
        // Refetch unread counts
        refetch();
        
        // Also dispatch event for other components to respond
        window.dispatchEvent(new CustomEvent('new-message'));
      }
    });
    
    newSocket.on('messagesRead', (data) => {
      console.log('[MobileNavigation] Messages read event received:', data);
      
      // Reset force count when messages are marked as read
      setForceCount(0);
      
      // Clear the cached data to ensure it's updated
      localStorage.removeItem('unread_messages_force_count');
      
      // Only clear specific sender if provided, otherwise clear all
      if (data && data.senderId) {
        // Update just that sender's count in the cached data
        try {
          const cachedData = localStorage.getItem('cached_unread_messages');
          if (cachedData) {
            const parsedData = JSON.parse(cachedData) as Record<string, number>;
            if (parsedData[data.senderId]) {
              delete parsedData[data.senderId];
              localStorage.setItem('cached_unread_messages', JSON.stringify(parsedData));
            }
          }
        } catch (error) {
          console.error("Error updating cached unread messages:", error);
        }
      } else {
        // Clear all cached unread messages if no specific sender
        localStorage.removeItem('cached_unread_messages');
      }
      
      // Refetch to get the latest counts from the server
      refetch();
    });
    
    // Listen for test events (for Playwright tests)
    const handleTestEvent = () => {
      refetch();
    };
    window.addEventListener("test:new-message", handleTestEvent);
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      window.removeEventListener("test:new-message", handleTestEvent);
    };
  }, [auth.user, refetch]);
  
  // For Playwright tests - check localStorage
  useEffect(() => {
    const checkTestData = () => {
      try {
        const testData = window.localStorage.getItem('__test_unread_senders');
        if (testData) {
          // Force a refetch when test data is present
          refetch();
        }
      } catch (error) {
        console.error("Error processing test data:", error);
      }
    };
    
    // Only run in test environments
    if (
      window.navigator.userAgent.includes('Playwright') || 
      window.localStorage.getItem('__playwright_test_mode') === 'true' ||
      window.location.search.includes('test=true')
    ) {
      // Check initially and set up interval
      checkTestData();
      const interval = setInterval(checkTestData, 1000);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [refetch]);
  
  // Save unread messages data to localStorage whenever it changes
  useEffect(() => {
    if (unreadSendersMap && Object.keys(unreadSendersMap).length > 0) {
      localStorage.setItem('cached_unread_messages', JSON.stringify(unreadSendersMap));
    }
  }, [unreadSendersMap]);
  
  // Save forceCount to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('unread_messages_force_count', forceCount.toString());
  }, [forceCount]);
  
  // If API is returning 0 but we have force counts from WebSocket events, use that
  const effectiveUnreadCount = totalUnreadCount === 0 && forceCount > 0 ? forceCount : totalUnreadCount;

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/connections", icon: Users, label: "Connections" },
    { href: "/messages", icon: MessageSquare, label: "Messages" }, // Changed to direct link to /messages
    { href: "/circles", icon: UserCircle, label: "Circles" },
    { href: "/spaces", icon: Sparkles, label: "Spaces" },
    { href: "/shadow-sessions", icon: CalendarDays, label: "Sessions" }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-30">
      <div className="flex justify-around items-center h-16">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}>
              <a className={cn(
                "flex flex-col items-center p-2",
                location === item.href 
                  ? "text-primary-600 dark:text-primary-400" 
                  : "text-gray-500 dark:text-gray-400"
              )}>
                <div className="relative">
                  <item.icon className="text-lg h-5 w-5" />
                  {item.href === "/messages" && effectiveUnreadCount > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white mobile-nav-messages-badge" 
                      data-testid="mobile-nav-messages-badge"
                    >
                      {effectiveUnreadCount > 9 ? "9+" : effectiveUnreadCount}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-1">{item.label}</span>
              </a>
            </Link>
          ))}
      </div>
    </div>
  );
};
