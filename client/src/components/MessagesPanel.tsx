import { FC, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Button } from "@/components/ui/button";
import { User } from "@/types";
import { useQuery, QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ChatPopup } from "./ChatPopup";
import { MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MessagesPanel: FC<MessagesPanelProps> = ({ isOpen, onClose }) => {
  const auth = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const [localUnreadCounts, setLocalUnreadCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('unreadMessageCounts_panel');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('[MessagesPanel] Error loading unread counts from localStorage:', e);
      return {};
    }
  });
  const [directMessageCheck, setDirectMessageCheck] = useState<Record<string, number>>({});

  const { data: onlineConnections = [] } = useQuery<User[]>({
    queryKey: ['/api/user/connections/online'],
    enabled: isOpen && !!auth.user,
  });

  const { data: unreadSendersMap = {} as Record<string, number> } = useQuery<Record<string, number>>({
    queryKey: ['/api/notifications/unread-message-senders'],
    enabled: isOpen && !!auth.user,
    staleTime: 10 * 1000,
  });

  useEffect(() => {
    if (!isOpen) return;
    try {
      const combinedCounts: Record<string, number> = { ...localUnreadCounts };
      Object.entries(directMessageCheck).forEach(([userId, count]) => {
        if (count > (combinedCounts[userId] || 0)) {
          combinedCounts[userId] = count;
        }
      });
      localStorage.setItem('unreadMessageCounts_panel', JSON.stringify(combinedCounts));
    } catch (e) {
      console.error('[MessagesPanel] Error saving unread counts to localStorage:', e);
    }
  }, [localUnreadCounts, directMessageCheck, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ease-in-out"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-4/5 max-w-md bg-white dark:bg-gray-900 shadow-xl z-50 transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Messages</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close messages panel">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Online Now</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {onlineConnections.length} connection{onlineConnections.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
                {onlineConnections.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No connections online.</p>
                )}
                {onlineConnections.map(connection => {
                  const apiUnreadCount = unreadSendersMap[connection.user_id] || 0;
                  const localUnreadCount = localUnreadCounts[connection.user_id] || 0;
                  const directCheckCount = directMessageCheck[connection.user_id] || 0;
                  const finalUnreadCount = Math.max(apiUnreadCount, localUnreadCount, directCheckCount);

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
                          try {
                            const roomResponse = await apiRequest(
                              'POST',
                              `/api/chat/dm/${connection.user_id}`
                            );
                            const roomData = await roomResponse.json();
                            if (!roomData || !roomData.chat_room_id) {
                              console.error("[MessagesPanel] Failed to get or create chat room. roomData:", roomData);
                              return;
                            }
                            setCurrentRoomId(roomData.chat_room_id);
                            setSelectedRecipient(connection);
                            setIsChatOpen(true);
                          } catch (error) {
                            console.error("[MessagesPanel] Error opening chat:", error);
                          }
                        }}
                        title={`Chat with ${connection.profile?.display_name || 'user'}`}
                      >
                        <MessageSquare className="h-4 w-4" />
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
          </div>
        </div>
        {auth.user && selectedRecipient && currentRoomId && isChatOpen && (
          <ChatPopup
            isOpen={isChatOpen}
            onClose={() => {
              setIsChatOpen(false);
              setSelectedRecipient(null);
              setCurrentRoomId(null);
              if (selectedRecipient) {
                setLocalUnreadCounts(prev => ({ ...prev, [selectedRecipient.user_id]: 0 }));
                setDirectMessageCheck(prev => ({ ...prev, [selectedRecipient.user_id]: 0 }));
                const qc = new QueryClient(); 
                qc.invalidateQueries({ queryKey: ['/api/notifications/unread-message-senders'] });
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
    </>
  );
};
