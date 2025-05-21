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

  // Get unread message sender IDs
  const { data: unreadMessageSenderIds = [] } = useQuery<string[]>({
    queryKey: ['/api/notifications/unread-message-senders'],
    enabled: !!auth.user, // Only fetch if user is authenticated
  });

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
            const hasUnread = unreadMessageSenderIds.includes(connection.user_id);
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
                  {hasUnread && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800" />
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
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-message-senders'] });
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
