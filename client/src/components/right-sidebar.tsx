import { FC, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { User, Group } from "@/types";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ChatPopup } from "./ChatPopup";
import io, { Socket } from 'socket.io-client';
import { MessageNotificationBadge } from '@/components/ui/message-notification-badge';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';

// Define event interfaces for the sidebar's socket listener
interface SidebarSocketEvents {
  newNotification: (data: { senderId: string, roomId?: string }) => void;
}

// GoogleTextAds component
const GoogleTextAds: FC = () => (
  <div className="mb-6">
    <Card className="mb-3 border border-yellow-300">
      <CardContent className="py-3 px-4">
        <div className="text-xs text-gray-400 mb-1">Ad · www.example-ad1.com</div>
        <div 
          className="font-semibold text-blue-700 mb-1 cursor-pointer hover:underline"
          onClick={() => alert("Coming Soon!")}
          title="Coming Soon!"
        >
          Try ShadowMe Pro – Boost Your Productivity
        </div>
        <div className="text-sm text-gray-700">Unlock advanced features and get more done. Start your free trial today!</div>
      </CardContent>
    </Card>
    <Card className="border border-yellow-300">
      <CardContent className="py-3 px-4">
        <div className="text-xs text-gray-400 mb-1">Ad · www.example-ad2.com</div>
        <div 
          className="font-semibold text-blue-700 mb-1 cursor-pointer hover:underline"
          onClick={() => alert("Coming Soon!")}
          title="Coming Soon!"
        >
          Meet New Friends Online – Join Now
        </div>
        <div className="text-sm text-gray-700">Connect instantly with like-minded people. Safe, fun, and free to join!</div>
      </CardContent>
    </Card>
  </div>
);

export const RightSidebar: FC = () => {
  const auth = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const socketRef = useRef<Socket<SidebarSocketEvents, any> | null>(null);
  // Add direct state tracking for unread messages
  const [localUnreadCounts, setLocalUnreadCounts] = useState<Record<string, number>>(() => {
    // Initialize from localStorage if available
    try {
      const saved = localStorage.getItem('unreadMessageCounts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('[RightSidebar] Error loading unread counts from localStorage:', e);
      return {};
    }
  });
  // Add a state for direct messages check
  const [directMessageCheck, setDirectMessageCheck] = useState<Record<string, number>>({});

  // Get connection suggestions
  const { data: suggestions = [] } = useQuery<User[]>({
    queryKey: ['/api/user/connection-suggestions'],
  });
  
  // Get popular spaces
  const { data: popularSpaces = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups/popular'],
  });
  
  // Get online connections
  const { data: onlineConnections = [], isSuccess: onlineConnectionsSuccess } = useQuery<User[]>({
    queryKey: ['/api/user/connections/online'],
  });

  // Get unread message sender counts
  const { data: unreadSendersMap = {} as Record<string, number>, isLoading: isLoadingUnreadMap, error: unreadMapError, refetch: refetchUnreadCounts } = useQuery<Record<string, number>>({
    queryKey: ['/api/notifications/unread-message-senders'],
    enabled: !!auth.user, // Only fetch if user is authenticated
    staleTime: 10 * 1000, // Consider data stale after 10 seconds
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when the window gets focus
  });

  // Log whenever component renders to check our state
  console.log('[RightSidebar MOUNT DEBUG] Current state:', { 
    unreadSendersMap,
    localUnreadCounts,
    isLoadingUnreadMap,
    hasError: !!unreadMapError,
    onlineConnectionsCount: onlineConnections.length
  });

  // Actively fetch unread counts on component mount
  useEffect(() => {
    if (auth.user) {
      console.log('[RightSidebar] Component mounted, explicitly fetching unread counts...');
      refetchUnreadCounts();
    }
  }, []); // Empty dependency array means this runs once on mount
  
  // Separate effect for checking direct messages after online connections is populated
  useEffect(() => {
    if (!auth.user || onlineConnections.length === 0) {
      console.log('[RightSidebar] Skipping direct message check - no user or no online connections');
      return;
    }
    
    console.log(`[RightSidebar] Running direct message check for ${onlineConnections.length} connections`);
    
    // Direct API call to check messages
    const checkDirectMessages = async () => {
      try {
        console.log('[RightSidebar] Making direct API call to check for unread messages...');
        
        // For each online connection, check if we have a chat room with them
        for (const connection of onlineConnections) {
          try {
            // First try to get or create a DM room with this user
            const roomResponse = await apiRequest(
              'POST',
              `/api/chat/dm/${connection.user_id}`
            );
            
            if (!roomResponse.ok) {
              console.error(`[RightSidebar] Failed to get chat room for ${connection.profile?.display_name}`);
              continue;
            }
            
            const roomData = await roomResponse.json();
            console.log(`[RightSidebar] Got room data for ${connection.profile?.display_name}:`, roomData);
            
            if (!roomData || !roomData.chat_room_id) {
              console.error(`[RightSidebar] Invalid room data for ${connection.profile?.display_name}`);
              continue;
            }
            
            // Now fetch messages for this room
            const messagesResponse = await apiRequest(
              'GET',
              `/api/chat/rooms/${roomData.chat_room_id}/messages`
            );
            
            if (!messagesResponse.ok) {
              console.error(`[RightSidebar] Failed to get messages for room ${roomData.chat_room_id}`);
              continue;
            }
            
            const messages = await messagesResponse.json();
            console.log(`[RightSidebar] Got ${messages.length} messages for room with ${connection.profile?.display_name}`);
            
            if (Array.isArray(messages)) {
              // Log the first few messages for debugging
              messages.slice(0, 3).forEach((msg, index) => {
                console.log(`[RightSidebar] Message ${index}: sender_id=${msg.sender_id}, recipient_id=${msg.recipient_id}, is_read=${msg.is_read}, content=${msg.body?.substring(0, 20) || '(no body)'}`);
              });
              
              // Count unread messages (where current user is recipient and is_read=false)
              const unreadCount = messages.filter(msg => 
                msg.sender_id !== auth.user?.user_id && // Messages FROM others TO me
                msg.is_read === false // That are unread
              ).length;
              
              console.log(`[RightSidebar] Found ${unreadCount} unread messages from ${connection.profile?.display_name}`);
              
              if (unreadCount > 0) {
                setDirectMessageCheck(prev => ({
                  ...prev,
                  [connection.user_id]: unreadCount
                }));
              }
            } else {
              console.error(`[RightSidebar] Messages response is not an array:`, messages);
            }
          } catch (error) {
            console.error(`[RightSidebar] Error checking messages for ${connection.profile?.display_name}:`, error);
          }
        }
      } catch (error) {
        console.error('[RightSidebar] Error in direct message check:', error);
      }
    };
    
    checkDirectMessages();
  }, [auth.user, onlineConnections]); // Run when auth.user or onlineConnections changes

  useEffect(() => {
    console.log('[RightSidebar DEBUG] unreadSendersMap updated:', unreadSendersMap);
    if(isLoadingUnreadMap) console.log('[RightSidebar DEBUG] isLoadingUnreadMap is true');
    if(unreadMapError) console.error('[RightSidebar DEBUG] unreadMapError:', unreadMapError);
    
    // Initialize localUnreadCounts from API data whenever unreadSendersMap changes
    if (!isLoadingUnreadMap && Object.keys(unreadSendersMap).length > 0) {
      console.log('[RightSidebar] Syncing localUnreadCounts with API data:', unreadSendersMap);
      setLocalUnreadCounts(prevCounts => {
        // Merge api data with any local counts, taking the higher value
        const mergedCounts = { ...prevCounts };
        
        Object.entries(unreadSendersMap).forEach(([userId, count]) => {
          mergedCounts[userId] = Math.max(count, mergedCounts[userId] || 0);
        });
        
        console.log('[RightSidebar] After merging, localUnreadCounts:', mergedCounts);
        return mergedCounts;
      });
    }
  }, [unreadSendersMap, isLoadingUnreadMap, unreadMapError]);

  // Refetch unread senders when online connections change (as a proxy for new activity)
  // or when the chat popup is closed (in case messages were read)
  useEffect(() => {
    if (onlineConnectionsSuccess || !isChatOpen) {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-message-senders'] });
    }
  }, [onlineConnectionsSuccess, isChatOpen]);

  // Effect for WebSocket connection for new notification events
  useEffect(() => {
    if (!auth.user) return;

    const newSocket = io(SOCKET_SERVER_URL, {
      auth: { userId: auth.user.user_id },
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log(`RightSidebar connected to WebSocket for notifications (socket ID: ${newSocket.id})`);
    });

    newSocket.on('newNotification', (data) => {
      console.log('RightSidebar received newNotification event:', data);
      
      // If this is a message notification and we have sender information, update our local count
      if (data.message && data.senderId) {
        setLocalUnreadCounts(prev => {
          const senderId = data.senderId;
          // Increment the count by 1 per new message
          const newCount = (prev[senderId] || 0) + 1;
          console.log(`[RightSidebar] Updating local unread count for sender ${senderId} to ${newCount}`);
          return {
            ...prev,
            [senderId]: newCount
          };
        });
        
        // If the incoming message is for a room we're already tracking
        if (isChatOpen && selectedRecipient && data.senderId === selectedRecipient.user_id) {
          // If the chat with this person is open, mark as read immediately
          console.log(`[RightSidebar] Chat with ${selectedRecipient.profile?.display_name} is open, keeping unread count at 0`);
          setLocalUnreadCounts(prev => ({
            ...prev,
            [selectedRecipient.user_id]: 0
          }));
          
          setDirectMessageCheck(prev => ({
            ...prev,
            [selectedRecipient.user_id]: 0
          }));
          
          // Also update localStorage for this user
          try {
            const saved = localStorage.getItem('unreadMessageCounts');
            const counts = saved ? JSON.parse(saved) : {};
            counts[selectedRecipient.user_id] = 0;
            localStorage.setItem('unreadMessageCounts', JSON.stringify(counts));
          } catch (e) {
            console.error('[RightSidebar] Error updating localStorage:', e);
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-message-senders'] });
    });

    newSocket.on('disconnect', () => {
      console.log('RightSidebar disconnected from WebSocket for notifications');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [auth.user]);
  
  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', `/api/friends/request/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/connection-suggestions'] });
    }
  });

  console.log('[RightSidebar RENDER] Evaluating component. onlineConnections:', onlineConnections, 'unreadSendersMap:', unreadSendersMap);

  // Save unread counts to localStorage whenever they change
  useEffect(() => {
    try {
      // Combine both count sources to ensure we save everything
      const combinedCounts: Record<string, number> = { ...directMessageCheck };
      
      // Add any counts from localUnreadCounts that aren't in directMessageCheck
      Object.entries(localUnreadCounts).forEach(([userId, count]) => {
        if (!combinedCounts[userId] || combinedCounts[userId] < count) {
          combinedCounts[userId] = count;
        }
      });
      
      localStorage.setItem('unreadMessageCounts', JSON.stringify(combinedCounts));
      console.log('[RightSidebar] Saved unread counts to localStorage:', combinedCounts);
    } catch (e) {
      console.error('[RightSidebar] Error saving unread counts to localStorage:', e);
    }
  }, [localUnreadCounts, directMessageCheck]);

  return (
    <div className="sticky top-20">
      {/* Google Text Ads */}
      <GoogleTextAds />
      {/* Online Connections */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Online Now</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {onlineConnections.length} connection{onlineConnections.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-hide">
          {onlineConnections.slice(0, 3).map(connection => {
            // Use local unread count if available, otherwise fall back to the API count
            const apiUnreadCount = unreadSendersMap[connection.user_id] || 0;
            const localUnreadCount = localUnreadCounts[connection.user_id] || 0;
            const directCheckCount = directMessageCheck[connection.user_id] || 0;
            
            // Prefer local count but fall back to API count if it's higher
            const unreadCount = Math.max(apiUnreadCount, localUnreadCount, directCheckCount);
            
            // Remove forced test value
            const finalUnreadCount = unreadCount;
            
            console.log(`[RightSidebar] User ${connection.profile?.display_name} (${connection.user_id}): apiCount=${apiUnreadCount}, localCount=${localUnreadCount}, directCheck=${directCheckCount}, finalCount=${finalUnreadCount}`);
            
            if (finalUnreadCount === 0) {
              console.log(`[RightSidebar] Not rendering badge for ${connection.profile?.display_name} because finalUnreadCount is 0.`);
            }
            return (
              <div key={connection.user_id} className="flex items-center space-x-3">
                <AvatarWithEmotion 
                  user={connection}
                  showOnlineStatus={true}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{connection.profile?.display_name}</h4>
                  <p className="text-xs text-green-500 truncate">Active now</p>
                </div>
                <Button 
                  variant="ghost"
                  size="icon"
                  className="relative text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-1"
                  onClick={async () => {
                    if (!auth.user) return;
                    console.log('[RightSidebar] Clicked message icon for connection:', connection.user_id);
                    try {
                      const roomResponse = await apiRequest(
                        'POST',
                        `/api/chat/dm/${connection.user_id}`
                      );
                      const roomData = await roomResponse.json();
                      console.log('[RightSidebar] Got roomData:', roomData);
                      if (!roomData || !roomData.chat_room_id) {
                        console.error("[RightSidebar] Failed to get or create chat room. roomData:", roomData);
                        return;
                      }
                      console.log('[RightSidebar] Setting state: roomId, recipient, isChatOpen=true');
                      setCurrentRoomId(roomData.chat_room_id);
                      setSelectedRecipient(connection);
                      setIsChatOpen(true);
                    } catch (error) {
                      console.error("[RightSidebar] Error opening chat:", error);
                    }
                  }}
                  title={`Chat with ${connection.profile?.display_name || 'user'}`}
                >
                  <MessageCircle className="h-4 w-4" />
                  {finalUnreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                      {finalUnreadCount > 9 ? '9+' : finalUnreadCount}
                    </span>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
      {/* Connection Suggestions */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Connection Suggestions</h3>
          <Link href="/connections">
            <Button variant="link" size="sm" className="text-primary-600 dark:text-primary-400 p-0 h-auto">
              See All
            </Button>
          </Link>
        </div>
        <div className="space-y-4">
          {suggestions.slice(0, 3).map(user => (
            <div key={user.user_id} className="flex items-center space-x-3">
              <AvatarWithEmotion user={user} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate">{user.profile?.display_name}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.mutualFriendCount || 0} mutual connection{user.mutualFriendCount !== 1 ? 's' : ''}
                </p>
              </div>
              <Button
                size="sm" 
                className="px-3 py-1.5 rounded-full text-xs"
                onClick={() => connectMutation.mutate(user.user_id)}
                disabled={connectMutation.isPending}
              >
                Connect
              </Button>
            </div>
          ))}
        </div>
      </Card>
      {/* Popular Spaces */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Popular Spaces</h3>
          <Link href="/spaces">
            <Button variant="link" size="sm" className="text-primary-600 dark:text-primary-400 p-0 h-auto">
              Browse All
            </Button>
          </Link>
        </div>
        <div className="space-y-4">
          {popularSpaces.slice(0, 2).map(space => (
            <div 
              key={space.group_id}
              className="group p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => alert("Coming Soon!")}
              title="Coming Soon!"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {space.name}
                </h4>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                  {space.memberCount || 0} members
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{space.description}</p>
              <div className="flex -space-x-2">
                {space.previewMembers?.slice(0, 3).map(member => (
                  <AvatarWithEmotion
                    key={member.user_id} 
                    user={member}
                    size="sm"
                    className="w-6 h-6 border border-white dark:border-gray-800"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {/* ChatPopup Integration */}
      {auth.user && selectedRecipient && currentRoomId && isChatOpen && (
        <ChatPopup
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setSelectedRecipient(null);
            setCurrentRoomId(null);
            
            // Reset unread counts for this user
            if (selectedRecipient) {
              console.log(`[RightSidebar] Resetting unread counts for ${selectedRecipient.profile?.display_name} after closing chat`);
              
              // Clear counts in all tracking mechanisms
              setLocalUnreadCounts(prev => ({
                ...prev,
                [selectedRecipient.user_id]: 0
              }));
              
              setDirectMessageCheck(prev => ({
                ...prev,
                [selectedRecipient.user_id]: 0
              }));
              
              // Also force a refetch of API data
              queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-message-senders'] });
            }
          }}
          currentUserId={auth.user.user_id}
          roomId={currentRoomId}
          otherParticipant={{
            id: selectedRecipient.user_id,
            displayName: selectedRecipient.profile?.display_name || selectedRecipient.email || 'User',
            avatarUrl: selectedRecipient.profile?.avatar_url,
          }}
        />
      )}
    </div>
  );
};
