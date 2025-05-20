# Shadow Me Implementation Guide

This guide provides practical examples and code snippets for implementing the key features of Shadow Me.

## Implementing Emotion-Based Features

### Using the EmotionSelector Component

```tsx
import { useState, useEffect } from 'react';
import { EmotionSelector } from "@/components/ui/emotion-selector";
import { useQuery } from "@tanstack/react-query";

function EmotionSelectorExample() {
  const [selectedEmotions, setSelectedEmotions] = useState<number[]>([]);
  
  // Fetch emotions from the API
  const { data: emotions = [] } = useQuery({
    queryKey: ["/api/emotions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-medium mb-4">How are you feeling?</h2>
      
      <EmotionSelector 
        emotions={emotions}
        selectedEmotions={selectedEmotions}
        onChange={setSelectedEmotions}
        max={3}
      />
      
      {selectedEmotions.length > 0 && (
        <div className="mt-4">
          <p>Selected emotions: 
            {selectedEmotions.map(id => {
              const emotion = emotions.find(e => e.id === id);
              return emotion ? emotion.name : '';
            }).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
```

### Using the AvatarWithEmotion Component

```tsx
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { useAuth } from "@/hooks/use-auth";

function AvatarExample() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <h2 className="text-lg font-medium">User Avatars with Emotion Rings</h2>
      
      <div className="flex gap-6 items-end">
        <div className="flex flex-col items-center">
          <AvatarWithEmotion user={user} size="sm" />
          <span className="text-xs mt-2">Small</span>
        </div>
        
        <div className="flex flex-col items-center">
          <AvatarWithEmotion user={user} size="md" />
          <span className="text-xs mt-2">Medium</span>
        </div>
        
        <div className="flex flex-col items-center">
          <AvatarWithEmotion user={user} size="lg" />
          <span className="text-xs mt-2">Large</span>
        </div>
      </div>
      
      <div className="mt-8">
        <h3 className="text-md font-medium mb-2">With Different Emotions</h3>
        <div className="flex gap-4">
          <AvatarWithEmotion user={user} emotionOverrides={[1]} />
          <AvatarWithEmotion user={user} emotionOverrides={[1, 2]} />
          <AvatarWithEmotion user={user} emotionOverrides={[1, 2, 3]} />
        </div>
      </div>
    </div>
  );
}
```

## Implementing Post Creation with Emotions

```tsx
import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EmotionSelector } from "@/components/ui/emotion-selector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const postSchema = z.object({
  content: z.string().min(1, "Post content is required").max(500, "Post content is too long"),
  audience: z.enum(["everyone", "friends", "just_me", "friend_group", "group"]),
});

function CreatePostForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEmotions, setSelectedEmotions] = useState<number[]>([]);
  
  const { data: emotions = [] } = useQuery({
    queryKey: ["/api/emotions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  
  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: "",
      audience: "everyone",
    },
  });
  
  const createPostMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/posts", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      form.reset();
      setSelectedEmotions([]);
      toast({
        title: "Post created",
        description: "Your post has been shared successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create post",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: z.infer<typeof postSchema>) => {
    if (selectedEmotions.length === 0) {
      toast({
        title: "Emotions required",
        description: "Please select at least one emotion for your post.",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("content", values.content);
    formData.append("audience", values.audience);
    formData.append("emotion_ids", JSON.stringify(selectedEmotions));
    
    createPostMutation.mutate(formData);
  };
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg">
      <h2 className="text-lg font-medium">Create a Post</h2>
      
      <div>
        <Textarea
          placeholder="What's on your mind?"
          className="min-h-[100px]"
          {...form.register("content")}
        />
        {form.formState.errors.content && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.content.message}</p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">How are you feeling?</label>
        <EmotionSelector
          emotions={emotions}
          selectedEmotions={selectedEmotions}
          onChange={setSelectedEmotions}
          max={3}
          disabled={createPostMutation.isPending}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Who can see this?</label>
        <Select
          defaultValue={form.getValues("audience")}
          onValueChange={(value) => form.setValue("audience", value as any)}
          disabled={createPostMutation.isPending}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select audience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everyone">Everyone</SelectItem>
            <SelectItem value="friends">Friends Only</SelectItem>
            <SelectItem value="just_me">Just Me</SelectItem>
            <SelectItem value="friend_group">Specific Friend Group</SelectItem>
            <SelectItem value="group">Specific Space</SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.audience && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.audience.message}</p>
        )}
      </div>
      
      <Button
        type="submit"
        className="w-full"
        disabled={createPostMutation.isPending}
      >
        {createPostMutation.isPending ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}
```

## Implementing Shadow Sessions

> **Note**: The Shadow Session functionality has been integrated into the `CreatePostDialog` component.

### Creating a Shadow Session

Shadow sessions are created using the `CreatePostDialog` component by setting the `initialIsShadowSession` prop to `true`, or by toggling the "Make this a Shadow Session" switch within the dialog. The dialog handles the necessary fields like title, description, start/end times, and audience.

### Joining a Shadow Session

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      // Send authentication message
      ws.send(JSON.stringify({
        type: 'auth',
        payload: {
          userId: user.user_id
        }
      }));
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };
    
    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('Failed to connect to WebSocket server');
      setConnected(false);
    };
    
    setSocket(ws);
    
    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user]);
  
  const sendMessage = (type: string, payload: any) => {
    if (socket && connected) {
      socket.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  };
  
  return {
    socket,
    connected,
    error,
    sendMessage
  };
}
```

### Using WebSockets for Online Status

```tsx
function OnlineStatusDisplay() {
  const { user } = useAuth();
  const { socket, connected, sendMessage } = useWebSocket();
  const [onlineFriends, setOnlineFriends] = useState<string[]>([]);
  
  useEffect(() => {
    if (!socket || !connected) return;
    
    // Listen for online status updates
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'online_status_update') {
          setOnlineFriends(data.payload.onlineUserIds);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    // Request initial online status
    sendMessage('get_online_friends', {});
    
    // Set up periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      sendMessage('heartbeat', {});
    }, 30000);
    
    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [socket, connected, sendMessage]);
  
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-medium mb-2">Online Friends ({onlineFriends.length})</h3>
      {onlineFriends.length === 0 ? (
        <p className="text-gray-500 text-sm">None of your friends are online right now.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Render online friends */}
        </div>
      )}
    </div>
  );
}
```

## Setting Up Auth Provider (Fixed Version)

```tsx
import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@/types";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  email: string;
  password: string;
  display_name: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Welcome back!",
        description: `Good to see you, ${user.profile?.display_name || 'Friend'}!`,
      });
      // Redirect to homepage after successful login
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", data);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Account created!",
        description: "Welcome to Shadow Me! Your journey begins now.",
      });
      // Redirect to homepage after successful registration
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You've been successfully logged out.",
      });
      // Redirect to auth page after logout
      navigate("/auth");
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

## Protected Route Component

```tsx
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
```

## Implementing Profile Pages

```tsx
import { FC, useState } from "react";
import { useRoute } from "wouter";
import { MainLayout } from "@/components/main-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { PostCard } from "@/components/post-card";
import { ShadowSessionCard } from "@/components/shadow-session-card";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { User, Post, Emotion } from "@/types";
import { Loader2, Edit3, MessageCircle } from "lucide-react";

function ProfilePageExample() {
  const { user } = useAuth();
  const [_, params] = useRoute("/profile/:userId");
  const userId = params?.userId || user?.user_id;
  const isOwnProfile = userId === user?.user_id;

  // Get profile data
  const { data: profileUser, isLoading: profileLoading } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });

  // Get emotions
  const { data: emotions = [] } = useQuery<Emotion[]>({
    queryKey: ['/api/emotions'],
  });

  // Get user posts
  const { data: userPosts = [], isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: [`/api/users/${userId}/posts`],
    enabled: !!userId,
  });

  if (profileLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary-500" />
        </div>
      </MainLayout>
    );
  }

  if (!profileUser) {
    return (
      <MainLayout>
        <Card className="p-8 text-center">
          <h3 className="text-lg font-medium mb-2">User not found</h3>
          <p className="text-gray-500 mb-4">
            The user profile you're looking for doesn't exist or you don't have permission to view it.
          </p>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Profile Header */}
      <Card className="overflow-hidden mb-6">
        <div className="h-32 bg-gradient-to-r from-primary-200 to-primary-100"></div>
        <div className="px-6 pb-6 relative">
          <div className="absolute -top-10 left-6 flex items-end">
            <AvatarWithEmotion 
              user={profileUser} 
              size="lg"
              className="border-4 border-white shadow-md"
            />
          </div>
          
          <div className="mt-12 flex flex-col md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {profileUser.profile?.display_name}
              </h1>
              <div className="text-gray-500 text-sm">
                <span>@{profileUser.email.split('@')[0]}</span>
              </div>
            </div>
            
            {isOwnProfile ? (
              <ProfileEditDialog>
                <Button variant="outline" size="sm" className="mt-4 md:mt-0">
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit Profile
                </Button>
              </ProfileEditDialog>
            ) : (
              <Button variant="default" size="sm" className="mt-4 md:mt-0">
                <MessageCircle className="h-4 w-4 mr-1" />
                Message
              </Button>
            )}
          </div>
        </div>
      </Card>
      
      {/* Profile Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
          <TabsTrigger value="shadow-sessions" className="flex-1">Shadow Sessions</TabsTrigger>
          <TabsTrigger value="media" className="flex-1">Media</TabsTrigger>
        </TabsList>
        
        <TabsContent value="posts">
          {postsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
            </div>
          ) : userPosts.filter(post => !post.shadow_session).length === 0 ? (
            <Card className="p-8 text-center">
              <h3 className="text-lg font-medium mb-2">No posts yet</h3>
              <p className="text-gray-500 mb-4">
                {isOwnProfile 
                  ? "Share your thoughts and feelings with your first post!"
                  : "This user hasn't posted anything yet."}
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {userPosts
                .filter(post => !post.shadow_session)
                .map(post => (
                  <PostCard 
                    key={post.post_id}
                    post={post}
                    emotions={emotions}
                  />
                ))
              }
            </div>
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
```

### Profile Edit Dialog Implementation

```tsx
import { FC, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function ProfileEditDialog({ children }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  
  // Form state
  const [displayName, setDisplayName] = useState(user?.profile?.display_name || "");
  const [bio, setBio] = useState(user?.profile?.bio || "");
  
  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`/api/users/${user?.user_id}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        throw new Error("Failed to update profile");
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.user_id}`] });
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated."
      });
      
      setOpen(false);
    }
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate({ display_name: displayName, bio });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

The profile page implementation has been enhanced with editing capabilities. Users can now:

1. View their own profile and the profiles of others
2. Edit their display name and bio through a modal dialog
3. See their posts and shadow sessions in a tabbed interface

The editing functionality demonstrates:

1. State management for form fields
2. Mutations with loading states and error handling
3. Optimistic UI updates by invalidating queries
4. Proper form submission handling

This component integration shows how different parts of the application work together to provide a complete user experience.

## Implementing Notification System

The notification system provides a UI for displaying notifications to users. Add it to your header or navigation:

```tsx
import { NotificationBell } from "@/components/ui/notification-bell";

function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <Logo />
        <NavLinks />
      </div>
      
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
```

### Fetching Notifications with React Query

The `NotificationBell` component internally uses React Query to fetch and manage notifications. Here's how it's implemented:

```tsx
// Inside NotificationBell component
const { data, isLoading } = useQuery({
  queryKey: ['/api/notifications'],
  queryFn: getQueryFn({ on401: 'throw' }),
  refetchInterval: 60000, // Refetch every minute
});

const notifications: Notification[] = data?.notifications || [];
const unreadCount = data?.unreadCount || 0;
```

### Marking Notifications as Read

When a user interacts with a notification, you'll want to mark it as read:

```tsx
const markAsReadMutation = useMutation({
  mutationFn: async (notificationId: string) => {
    return apiRequest('POST', `/api/notifications/${notificationId}/read`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
  },
});

// Later in your code
const handleNotificationClick = (notification) => {
  if (!notification.is_read) {
    markAsReadMutation.mutate(notification.notification_id);
  }
  
  // Navigate to the relevant content
  navigate(`/relevant-path/${notification.related_item_id}`);
};
```

### Adding Real-time Updates

For a more responsive experience, you can use WebSockets to deliver notifications in real-time:

```tsx
// In websocket.ts on the server
socket.on('message', async (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'create_notification') {
    const { recipientId, senderId, type, content, relatedItemId } = message.payload;
    
    // Create notification in the database
    await storage.createNotification({
      recipient_user_id: recipientId,
      sender_user_id: senderId,
      type,
      content,
      related_item_id: relatedItemId
    });
    
    // If recipient is online, send real-time notification
    if (clients.has(recipientId)) {
      const client = clients.get(recipientId)!;
      client.ws.send(JSON.stringify({
        type: 'notification',
        payload: {
          type,
          content,
          sender_id: senderId,
          created_at: new Date().toISOString()
        }
      }));
    }
  }
});
```

### Notification Types and Icons

The notification system supports various types of notifications, each with its own icon:

```tsx
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
```

This implementation allows for easy expansion of notification types as your application evolves.

### Notification Badge

The notification badge shows the count of unread notifications:

```tsx
<Button variant="ghost" size="icon" className="relative">
  <Bell className="h-5 w-5" />
  {unreadCount > 0 && (
    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  )}
</Button>
```

By following these patterns, you can create a robust notification system that keeps users engaged and informed about activity relevant to them.

These implementation guides provide a starting point for building the key features of the Shadow Me platform. Each component can be expanded and customized as needed to fit the specific design and functionality requirements.

## Implementing Media Upload System

The platform includes a comprehensive media upload system that allows users to share images in posts and shadow sessions. This implementation guide covers how to use and extend the media features.

### Media Upload in Posts

The post creation dialog includes media upload functionality:

```tsx
// Inside CreatePostDialog component
const [media, setMedia] = useState<File | null>(null);
const [previewUrl, setPreviewUrl] = useState<string | null>(null);

// Handle media upload
const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }
    
    setMedia(file);
    setPreviewUrl(URL.createObjectURL(file));
  }
};

// Form submission with media
const handleSubmit = () => {
  const formData = new FormData();
  formData.append('content', content);
  formData.append('emotion_ids', JSON.stringify(selectedEmotions));
  formData.append('audience', audience);
  
  if (media) {
    formData.append('media', media);
  }
  
  createPostMutation.mutate(formData);
};
```

### Server-Side Storage Implementation

The server handles media uploads with Multer for temporary storage and Supabase for cloud storage:

```typescript
// In server/routes.ts
app.post("/api/posts", isAuthenticated, upload.single('media'), async (req, res) => {
  try {
    // Create the post first to get a post_id
    const post = await storage.createPost({
      author_user_id: req.user!.user_id,
      parent_type: 'profile',
      parent_id: req.user!.user_id,
      audience,
      content: content || null,
      emotion_ids: parsedEmotionIds,
      friend_group_ids: parsedFriendGroupIds
    });
    
    // Handle file upload using Supabase storage
    if (req.file) {
      try {
        const mediaUrl = await storage.uploadPostMedia(
          req.file.path, 
          req.file.originalname, 
          post.post_id
        );
        
        console.log(`Media uploaded successfully to ${mediaUrl}`);
      } catch (uploadError) {
        console.error("Error uploading media to Supabase:", uploadError);
      }
    }
    
    res.status(201).json(post);
  } catch (err) {
    console.error("Failed to create post:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
});
```

### Storage Service Implementation

The actual upload to Supabase storage is handled by the storage service:

```typescript
// In server/storage.ts
async uploadPostMedia(filePath: string, fileName: string, postId: string): Promise<string> {
  try {
    const fs = await import('fs');
    const fileData = fs.readFileSync(filePath);
    const fileExt = fileName.split('.').pop();
    const timestamp = Date.now();
    const uniqueFileName = `post_${postId}_${timestamp}.${fileExt}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase
      .storage
      .from('post-media')
      .upload(uniqueFileName, fileData, {
        contentType: this.getMimeType(fileExt || ''),
        upsert: false
      });
    
    if (error) {
      throw error;
    }

    // Generate a public URL for the uploaded file
    const { data: { publicUrl } } = supabase
      .storage
      .from('post-media')
      .getPublicUrl(uniqueFileName);

    // Clean up the temporary file
    fs.unlinkSync(filePath);
    
    // Add entry to post_media table
    await db.insert(post_media).values({
      post_id: postId,
      media_url: publicUrl,
      media_type: this.getMimeType(fileExt || '')
    });
    
    return publicUrl;
  } catch (error) {
    console.error("Error uploading post media:", error);
    throw error;
  }
}
```

### Displaying Media with MediaGallery

The `MediaGallery` component provides a way to display media items with a lightbox feature:

```tsx
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Media } from '@/types';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaGalleryProps {
  media: Media[];
  className?: string;
}

export function MediaGallery({ media, className }: MediaGalleryProps) {
  const [activeMedia, setActiveMedia] = useState<Media | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  // Display logic for different numbers of media items
  if (media.length === 1) {
    return (
      <div 
        className="rounded-md overflow-hidden cursor-pointer"
        onClick={() => {
          setActiveMedia(media[0]);
          setLightboxOpen(true);
        }}
      >
        <img 
          src={media[0].media_url} 
          alt="Media" 
          className="w-full h-auto max-h-[300px] object-cover rounded-md" 
        />
        
        {/* Lightbox dialog */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[90vw] p-0">
            <img 
              src={activeMedia?.media_url} 
              alt="Media" 
              className="max-h-[80vh] max-w-full object-contain" 
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  } else {
    // Grid layout for multiple media items
    return (
      <div className="grid grid-cols-2 gap-2">
        {media.map((item, index) => (
          <div 
            key={item.media_id} 
            className="rounded-md overflow-hidden cursor-pointer"
            onClick={() => {
              setActiveMedia(item);
              setLightboxOpen(true);
            }}
          >
            <img 
              src={item.media_url} 
              alt={`Media ${index + 1}`} 
              className="w-full h-[150px] object-cover" 
            />
          </div>
        ))}
        
        {/* Lightbox with navigation for multiple images */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          {/* Lightbox content with navigation controls */}
        </Dialog>
      </div>
    );
  }
}
```

### Integration with Supabase

To set up Supabase storage for your project:

1. Create a Supabase project at https://supabase.com
2. Configure two storage buckets: `post-media` and `shadow-session-media`
3. Set appropriate security policies for each bucket
4. Add your Supabase URL and key to the `.env` file:

```
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_KEY=your_service_role_key
```

The platform's design separates storage concerns by bucket:
- `post-media`: For media attached to regular posts
- `shadow-session-media`: For media shared during shadow sessions

This separation helps with organization and security policies.

## Implementing Avatar Upload Functionality

The avatar upload functionality allows users to personalize their profiles with custom images. This implementation guide demonstrates how to implement avatar upload with a preview and proper validation.

### Avatar Upload Component

```tsx
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string;
  displayName: string;
  onSuccess?: (avatarUrl: string) => void;
}

export function AvatarUpload({ userId, currentAvatarUrl, displayName, onSuccess }: AvatarUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Clean up preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);
  
  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const res = await apiRequest("POST", `/api/users/${userId}/avatar`, formData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
      
      // Invalidate user query to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Reset state
      setAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
      
      // Call success callback if provided
      if (onSuccess && data.avatar_url) {
        onSuccess(data.avatar_url);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update avatar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (JPEG, PNG, GIF).",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Avatar image must be less than 2MB.",
          variant: "destructive",
        });
        return;
      }
      
      setAvatarFile(file);
      
      // Create and set preview
      const preview = URL.createObjectURL(file);
      setAvatarPreview(preview);
    }
  };
  
  // Handle avatar selection button click
  const handleSelectAvatar = () => {
    fileInputRef.current?.click();
  };
  
  // Clear avatar selection
  const handleClearAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Upload avatar
  const handleUpload = () => {
    if (avatarFile) {
      uploadAvatarMutation.mutate(avatarFile);
    }
  };
  
  // Get initials for avatar fallback
  const getInitials = () => {
    return displayName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <Avatar className="h-24 w-24 border-2 border-primary/10">
          <AvatarImage 
            src={avatarPreview || currentAvatarUrl} 
            alt={displayName} 
          />
          <AvatarFallback className="text-xl">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
          onClick={handleSelectAvatar}
        >
          <Camera className="h-4 w-4" />
        </Button>
        {avatarPreview && (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleClearAvatar}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarChange}
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
      />
      
      {avatarPreview && (
        <Button
          onClick={handleUpload}
          disabled={uploadAvatarMutation.isPending}
          size="sm"
        >
          {uploadAvatarMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : "Upload Avatar"}
        </Button>
      )}
      
      <p className="text-xs text-gray-500 text-center">
        Upload a profile picture (max 2MB).<br />
        Supported formats: JPEG, PNG, GIF
      </p>
    </div>
  );
}