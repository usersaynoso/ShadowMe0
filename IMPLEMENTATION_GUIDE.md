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

### Creating a Shadow Session

```tsx
import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { TimePicker } from "@/components/ui/time-picker";

const shadowSessionSchema = z.object({
  title: z.string().min(3, "Title is required").max(100),
  startDate: z.date(),
  startTime: z.string(),
  endDate: z.date(),
  endTime: z.string(),
});

function CreateShadowSessionForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [selectedEmotions, setSelectedEmotions] = useState<number[]>([]);
  
  const form = useForm<z.infer<typeof shadowSessionSchema>>({
    resolver: zodResolver(shadowSessionSchema),
    defaultValues: {
      title: "",
      startDate: new Date(),
      startTime: "12:00",
      endDate: new Date(),
      endTime: "13:00",
    },
  });
  
  const createSessionMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/posts", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shadow-sessions/upcoming"] });
      form.reset();
      setContent("");
      setSelectedEmotions([]);
      toast({
        title: "Shadow session created",
        description: "Your shadow session has been scheduled!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create shadow session",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: z.infer<typeof shadowSessionSchema>) => {
    if (selectedEmotions.length === 0) {
      toast({
        title: "Emotions required",
        description: "Please select at least one emotion for your shadow session.",
        variant: "destructive",
      });
      return;
    }
    
    // Create start and end datetime objects
    const startDateTime = new Date(values.startDate);
    const [startHours, startMinutes] = values.startTime.split(":").map(Number);
    startDateTime.setHours(startHours, startMinutes);
    
    const endDateTime = new Date(values.endDate);
    const [endHours, endMinutes] = values.endTime.split(":").map(Number);
    endDateTime.setHours(endHours, endMinutes);
    
    // Check that end is after start
    if (endDateTime <= startDateTime) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("content", content);
    formData.append("audience", "everyone");
    formData.append("emotion_ids", JSON.stringify(selectedEmotions));
    formData.append("is_shadow_session", "true");
    formData.append("session_title", values.title);
    formData.append("starts_at", startDateTime.toISOString());
    formData.append("ends_at", endDateTime.toISOString());
    formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    createSessionMutation.mutate(formData);
  };
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 border rounded-lg">
      <h2 className="text-xl font-medium">Create a Shadow Session</h2>
      
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Session Title</label>
        <Input
          placeholder="Reading together in silence"
          {...form.register("title")}
        />
        {form.formState.errors.title && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.title.message}</p>
        )}
      </div>
      
      {/* Start Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(form.watch("startDate"), "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch("startDate")}
                onSelect={(date) => date && form.setValue("startDate", date)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start Time</label>
          <TimePicker
            value={form.watch("startTime")}
            onChange={(time) => form.setValue("startTime", time)}
          />
        </div>
      </div>
      
      {/* End Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(form.watch("endDate"), "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch("endDate")}
                onSelect={(date) => date && form.setValue("endDate", date)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Time</label>
          <TimePicker
            value={form.watch("endTime")}
            onChange={(time) => form.setValue("endTime", time)}
          />
        </div>
      </div>
      
      {/* Description and emotions */}
      <div>
        <label className="block text-sm font-medium mb-1">Session Description</label>
        <Textarea
          placeholder="What will this shadow session be about?"
          className="min-h-[100px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Emotions for this session</label>
        <EmotionSelector
          emotions={emotions}
          selectedEmotions={selectedEmotions}
          onChange={setSelectedEmotions}
          max={3}
          disabled={createSessionMutation.isPending}
        />
      </div>
      
      <Button
        type="submit"
        className="w-full"
        disabled={createSessionMutation.isPending}
      >
        {createSessionMutation.isPending ? "Creating Session..." : "Create Shadow Session"}
      </Button>
    </form>
  );
}
```

## Implementing Real-time Features with WebSockets

### Client-side WebSocket Setup

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

These implementation guides provide a starting point for building the key features of the Shadow Me platform. Each component can be expanded and customized as needed to fit the specific design and functionality requirements.