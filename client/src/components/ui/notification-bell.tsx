import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AvatarWithEmotion } from '@/components/ui/avatar-with-emotion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';

interface Notification {
  notification_id: string;
  recipient_user_id: string;
  sender_user_id: string | null;
  type: string;
  content: string;
  related_item_id: string | null;
  is_read: boolean;
  created_at: string;
  sender?: {
    user_id: string;
    email: string;
    profile?: {
      display_name: string;
      avatar_url: string | null;
    }
  } | null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  
  // Fetch notifications
  const { data, isLoading } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: getQueryFn({ on401: 'throw' }),
    refetchInterval: 60000, // Refetch every minute
  });
  
  const notifications: Notification[] = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  
  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest('POST', `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: 'All notifications marked as read',
      });
    },
  });
  
  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest('DELETE', `/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });
  
  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      await markAsReadMutation.mutate(notification.notification_id);
    }
    
    // Navigate to relevant content based on notification type
    if (notification.related_item_id) {
      switch (notification.type) {
        case 'post_liked':
        case 'post_commented':
          navigate(`/post/${notification.related_item_id}`);
          break;
        case 'shadow_session_created':
          navigate(`/shadow-session/${notification.related_item_id}`);
          break;
        case 'friendship_request':
        case 'friendship_accepted':
          navigate(`/profile/${notification.related_item_id}`);
          break;
        default:
          // Default to home page
          navigate('/');
      }
    }
    
    setOpen(false);
  };
  
  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'post_liked':
        return '❤️';
      case 'post_commented':
        return '💬';
      case 'shadow_session_created':
        return '👥';
      case 'friendship_request':
        return '👋';
      case 'friendship_accepted':
        return '🤝';
      default:
        return '📣';
    }
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4">
          <h4 className="font-medium">Notifications</h4>
          {notifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-xs text-muted-foreground"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        {isLoading ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {notifications.map((notification) => (
              <div
                key={notification.notification_id}
                className={`flex gap-3 p-4 hover:bg-secondary/50 cursor-pointer ${!notification.is_read ? 'bg-secondary/30' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex-shrink-0">
                  {notification.sender ? (
                    <AvatarWithEmotion 
                      user={notification.sender}
                      size="sm"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">
                      {notification.sender?.profile?.display_name || 'Someone'}
                    </span>{' '}
                    {notification.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), { 
                      addSuffix: true 
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotificationMutation.mutate(notification.notification_id);
                  }}
                >
                  <span className="sr-only">Delete</span>
                  <span className="text-xs">×</span>
                </Button>
              </div>
            ))}
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
} 