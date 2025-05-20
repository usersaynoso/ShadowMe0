import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShadowSessionChat } from "@/components/shadow-session-chat";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { Loader2, ArrowLeft, Calendar, Clock, Users, Activity, Heart } from "lucide-react";
import { ShadowSession, Post, User, Emotion } from "@/types";
import { ShadowSessionMediaGallery } from "@/components/shadow-session-media-gallery";

// Helper function to create a fallback user
const createFallbackUser = (userId: string, displayName: string = "Unknown User"): User => ({
  user_id: userId,
  email: `${userId}@example.com`,
  user_type: "user",
  user_points: "0",
  user_level: 1,
  is_active: true,
  created_at: new Date().toISOString(),
  profile: {
    display_name: displayName,
    avatar_url: undefined,
    bio: undefined,
  },
});

export function ShadowSessionViewPage() {
  const { user } = useAuth();
  const [_, params] = useRoute("/shadow-sessions/:sessionId");
  const sessionId = params?.sessionId;
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  // Get session details
  const { data: session, isLoading: sessionLoading } = useQuery<ShadowSession>({
    queryKey: ['/api/shadow-sessions', sessionId],
    enabled: !!sessionId,
  });
  
  // Get post details if not included in session
  const { data: post, isLoading: postLoading } = useQuery<Post>({
    queryKey: ['/api/posts', sessionId],
    enabled: !!sessionId && !session?.post,
  });
  
  // Get emotions
  const { data: emotions = [] } = useQuery<Emotion[]>({
    queryKey: ['/api/emotions'],
  });
  
  // Get participants
  const { data: participants = [] } = useQuery<User[]>({
    queryKey: ['/api/shadow-sessions', sessionId, 'participants'],
    enabled: !!sessionId,
  });
  
  // Join session mutation
  const joinSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/shadow-sessions/${sessionId}/join`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shadow-sessions', sessionId, 'participants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shadow-sessions/joined'] });
    }
  });
  
  // Check if session is active (happening now)
  const isSessionActive = (session: ShadowSession) => {
    const startTime = new Date(session.starts_at);
    const endTime = new Date(session.ends_at);
    return isAfter(currentTime, startTime) && isBefore(currentTime, endTime);
  };
  
  // Check if user has joined the session
  const hasJoined = participants.some(p => p.user_id === user?.user_id);
  
  // Combined loading state
  const isLoading = sessionLoading || postLoading;
  
  // Fallback values
  const sessionPost = session?.post || post;
  
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
        </div>
      </MainLayout>
    );
  }
  
  if (!session || !sessionPost) {
    return (
      <MainLayout>
        <Card className="p-8 text-center">
          <h3 className="text-lg font-medium mb-2">Session not found</h3>
          <p className="text-gray-500 mb-4">
            The shadow session you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Link href="/shadow-sessions">
            <Button variant="secondary">Back to Shadow Sessions</Button>
          </Link>
        </Card>
      </MainLayout>
    );
  }
  
  const active = isSessionActive(session);
  const startTime = new Date(session.starts_at);
  const endTime = new Date(session.ends_at);
  
  // Get the creator (fallback if needed)
  const creator = session.creator || createFallbackUser(sessionPost.author_user_id || "unknown", "Unknown Host");
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/shadow-sessions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{session.title}</h1>
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <Calendar className="h-4 w-4 mr-1" />
              <span>{format(startTime, "EEEE, MMMM d")}</span>
              <span className="mx-2">•</span>
              <Clock className="h-4 w-4 mr-1" />
              <span>{format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}</span>
              <span className="mx-2">•</span>
              <Users className="h-4 w-4 mr-1" />
              <span>{participants.length} participants</span>
            </div>
          </div>
        </div>
        
        {/* Status badge */}
        <div className="flex justify-between items-center">
          {active ? (
            <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
              Live Now
            </div>
          ) : (
            startTime > currentTime ? (
              <div className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm">
                Coming up: {format(startTime, "MMM d, h:mm a")}
              </div>
            ) : (
              <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm">
                Ended
              </div>
            )
          )}
          
          {startTime >= currentTime && !hasJoined && (
            <Button
              onClick={() => joinSessionMutation.mutate()}
              disabled={joinSessionMutation.isPending}
            >
              {joinSessionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>Join Session</>
              )}
            </Button>
          )}
          
          {hasJoined && !active && (
            <Button variant="outline" disabled>
              You've joined
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <AvatarWithEmotion 
                    user={creator} 
                    size="md" 
                  />
                  <div>
                    <h3 className="font-medium">
                      {creator.profile?.display_name || "Unknown"}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Host
                    </p>
                  </div>
                </div>
                
                {sessionPost.emotion_ids && sessionPost.emotion_ids.length > 0 && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <div className="text-sm text-gray-600">
                      {sessionPost.emotion_ids.map(id => {
                        const emotion = emotions.find(e => e.id === id);
                        return emotion ? emotion.name : "";
                      }).filter(Boolean).join(", ")}
                    </div>
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p>{sessionPost.content}</p>
                </div>
              </CardContent>
              
              <CardFooter className="border-t pt-4 flex justify-between">
                <div className="flex items-center space-x-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-500"
                    onClick={() => alert("Coming Soon!")}
                    title="Coming Soon!"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    {sessionPost.reactions_count || 0}
                  </Button>
                </div>
              </CardFooter>
            </Card>
            
            {active && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <h2 className="text-lg font-medium">Session Chat</h2>
                </CardHeader>
                <CardContent className="p-0 h-[500px]">
                  <ShadowSessionChat sessionId={session.post_id} isActive={active} />
                </CardContent>
              </Card>
            )}
            
            {/* Add the media gallery component */}
            <Card>
              <CardHeader className="pb-3">
                <h2 className="text-lg font-medium">Shared Media</h2>
              </CardHeader>
              <CardContent>
                <ShadowSessionMediaGallery sessionId={session.post_id} />
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-lg font-medium">Participants ({participants.length})</h2>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No one has joined yet. Be the first!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {participants.map(participant => (
                      <div key={participant.user_id} className="flex items-center space-x-3">
                        <AvatarWithEmotion 
                          user={participant} 
                          size="sm" 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {participant.profile?.display_name || "Anonymous"}
                          </p>
                          {participant.isOnline && (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>
                              Online
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-lg font-medium">About this session</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Date and Time</h3>
                  <p className="text-sm">
                    {format(startTime, "EEEE, MMMM d, yyyy")}
                    <br />
                    {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Timezone</h3>
                  <p className="text-sm">{session.timezone}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 