import { FC, useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { CreatePostDialog } from "@/components/create-post-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShadowSession, Post } from "@/types";
import { format, parseISO, isToday, isTomorrow, isAfter, isBefore, addWeeks } from "date-fns";
import { Loader2, Search, CalendarDays, Clock, Plus, CheckCircle, Globe, Users } from "lucide-react";

const ShadowSessionsPage: FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  
  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  // Open dialog if ?openCreate=1 is in the URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('openCreate') === '1') {
        setOpenCreateDialog(true);
        // Optionally, remove the param from the URL after opening
        params.delete('openCreate');
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);
  
  // Get upcoming shadow sessions
  const { data: upcomingSessions = [], isLoading: upcomingLoading, error: upcomingError } = useQuery<ShadowSession[]>({
    queryKey: ['/api/shadow-sessions/upcoming'],
    enabled: !!user,
    retry: 2, // Only retry twice on error
  });
  
  // Get sessions current user has joined
  const { data: myJoinedSessions = [], isLoading: joinedLoading, error: joinedError } = useQuery<ShadowSession[]>({
    queryKey: ['/api/shadow-sessions/joined'],
    enabled: !!user,
    retry: 2,
  });
  
  // Get past sessions
  const { data: pastSessions = [], isLoading: pastLoading, error: pastError } = useQuery<ShadowSession[]>({
    queryKey: ['/api/shadow-sessions/past'],
    enabled: !!user,
    retry: 2,
  });
  
  // Get active sessions (happening now)
  const { data: activeSessions = [], isLoading: activeLoading, error: activeError } = useQuery<ShadowSession[]>({
    queryKey: ['/api/shadow-sessions/active'],
    enabled: !!user,
    retry: 2,
  });
  
  // Join session mutation
  const joinSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest('POST', `/api/shadow-sessions/${sessionId}/join`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shadow-sessions'] });
    }
  });
  
  // Filter sessions by search query
  const filterSessionsBySearch = (sessions: ShadowSession[]) => {
    if (!searchQuery) return sessions;
    return sessions.filter(
      session => 
        session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.post?.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };
  
  // Check if user has joined a session
  const hasJoinedSession = (session: ShadowSession) => {
    return session.participants?.some(p => p.user_id === user?.user_id);
  };
  
  // Check if session is active (happening now)
  const isSessionActive = (session: ShadowSession) => {
    const startTime = new Date(session.starts_at);
    const endTime = new Date(session.ends_at);
    return isAfter(currentTime, startTime) && isBefore(currentTime, endTime);
  };
  
  // Format date with relative terms like "Today" or "Tomorrow"
  const formatSessionDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };
  
  // Get status badge for a session
  const getSessionStatusBadge = (session: ShadowSession) => {
    const startTime = new Date(session.starts_at);
    const endTime = new Date(session.ends_at);
    
    if (isAfter(currentTime, startTime) && isBefore(currentTime, endTime)) {
      return (
        <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></div>
          Live Now
        </div>
      );
    }
    
    if (isBefore(startTime, addWeeks(currentTime, 1))) {
      return (
        <div className="px-2 py-1 bg-purple-100 dark:bg-purple-800/30 text-purple-800 dark:text-purple-300 rounded text-xs">
          {formatSessionDate(session.starts_at)}
        </div>
      );
    }
    
    return (
      <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
        {format(startTime, "MMM d")}
      </div>
    );
  };
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Shadow Sessions</h1>
          <CreatePostDialog open={openCreateDialog} onOpenChange={setOpenCreateDialog} initialIsShadowSession={true}>
            <Button className="flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Create Session
            </Button>
          </CreatePostDialog>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search sessions..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Active Sessions (if any) */}
        {!activeLoading && activeSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse"></div>
              Happening Now
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filterSessionsBySearch(activeSessions).map(session => (
                <Card 
                  key={session.post_id} 
                  className="bg-white dark:bg-gray-800 border-green-200 dark:border-green-800"
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold">{session.title}</h3>
                      <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></div>
                        Live Now
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <Clock className="h-4 w-4 mr-1" />
                      {format(parseISO(session.starts_at), "h:mm a")} - {format(parseISO(session.ends_at), "h:mm a")}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="flex items-center mb-3">
                      <AvatarWithEmotion 
                        user={session.creator || { user_id: "", profile: { display_name: "Unknown" } }}
                        size="sm"
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">{session.creator?.profile?.display_name}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {session.post?.content || "No description"}
                    </p>
                    
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center">
                        <div className="flex -space-x-2 mr-2">
                          {session.participants?.slice(0, 3).map(participant => (
                            <AvatarWithEmotion
                              key={participant.user_id} 
                              user={participant}
                              size="sm"
                              className="w-6 h-6 border border-white dark:border-gray-800"
                            />
                          ))}
                          
                          {session.participants && session.participants.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/30 border border-white dark:border-gray-800 flex items-center justify-center">
                              <span className="text-xs text-purple-800 dark:text-purple-300">+{session.participants.length - 3}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">
                          {session.participants?.length || 0} participants
                        </span>
                      </div>
                      
                      <div className="flex items-center">
                        {session.post?.audience === 'everyone' ? (
                          <Globe className="h-3 w-3 mr-1 text-gray-400" />
                        ) : (
                          <Users className="h-3 w-3 mr-1 text-gray-400" />
                        )}
                        <span className="text-gray-500">
                          {session.post?.audience === 'everyone' ? 'Everyone' : 
                           session.post?.audience === 'friends' ? 'Connections' : 
                           session.post?.audience === 'friend_group' ? 'Circle' : 'Private'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    {hasJoinedSession(session) ? (
                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Join Now
                      </Button>
                    ) : (
                      <Button 
                        className="w-full"
                        onClick={() => joinSessionMutation.mutate(session.post_id)}
                        disabled={joinSessionMutation.isPending}
                      >
                        {joinSessionMutation.isPending ? "Joining..." : "Join Session"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="joined">Joined</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          
          {/* Upcoming Tab */}
          <TabsContent value="upcoming">
            {upcomingLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : filterSessionsBySearch(upcomingSessions).length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No upcoming sessions</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery 
                    ? "No sessions match your search. Try a different query."
                    : "There are no upcoming shadow sessions at the moment."}
                </p>
                <div className="flex gap-3 justify-center">
                  <CreatePostDialog initialIsShadowSession={true}>
                    <Button>Schedule Your First Session</Button>
                  </CreatePostDialog>
                  {searchQuery && (
                    <Button 
                      variant="outline" 
                      onClick={() => setSearchQuery("")}
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filterSessionsBySearch(upcomingSessions).map(session => (
                  <Card key={session.post_id} className="bg-white dark:bg-gray-800">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold">{session.title}</h3>
                        {getSessionStatusBadge(session)}
                      </div>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {format(parseISO(session.starts_at), "h:mm a")} - {format(parseISO(session.ends_at), "h:mm a")}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center mb-3">
                        <AvatarWithEmotion 
                          user={session.creator || { user_id: "", profile: { display_name: "Unknown" } }}
                          size="sm"
                          className="mr-2"
                        />
                        <span className="text-sm font-medium">{session.creator?.profile?.display_name}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {session.post?.content || "No description"}
                      </p>
                      
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center">
                          <div className="flex -space-x-2 mr-2">
                            {session.participants?.slice(0, 3).map(participant => (
                              <AvatarWithEmotion
                                key={participant.user_id} 
                                user={participant}
                                size="sm"
                                className="w-6 h-6 border border-white dark:border-gray-800"
                              />
                            ))}
                            
                            {session.participants && session.participants.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/30 border border-white dark:border-gray-800 flex items-center justify-center">
                                <span className="text-xs text-purple-800 dark:text-purple-300">+{session.participants.length - 3}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-gray-500 dark:text-gray-400">
                            {session.participants?.length || 0} participants
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {hasJoinedSession(session) ? (
                        <Button variant="outline" className="w-full">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Joined
                        </Button>
                      ) : (
                        <Button 
                          className="w-full"
                          onClick={() => joinSessionMutation.mutate(session.post_id)}
                          disabled={joinSessionMutation.isPending}
                        >
                          {joinSessionMutation.isPending ? "Joining..." : "Join Session"}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Joined Tab */}
          <TabsContent value="joined">
            {joinedLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : filterSessionsBySearch(myJoinedSessions).length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No joined sessions</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery 
                    ? "No joined sessions match your search."
                    : "You haven't joined any upcoming shadow sessions yet."}
                </p>
                {searchQuery ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                ) : (
                  <Button onClick={() => document.querySelector('[data-value="upcoming"]')?.click()}>
                    Browse Upcoming Sessions
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filterSessionsBySearch(myJoinedSessions).map(session => (
                  <Card key={session.post_id} className="bg-white dark:bg-gray-800">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold">{session.title}</h3>
                        {getSessionStatusBadge(session)}
                      </div>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {format(parseISO(session.starts_at), "h:mm a")} - {format(parseISO(session.ends_at), "h:mm a")}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center mb-3">
                        <AvatarWithEmotion 
                          user={session.creator || { user_id: "", profile: { display_name: "Unknown" } }}
                          size="sm"
                          className="mr-2"
                        />
                        <span className="text-sm font-medium">{session.creator?.profile?.display_name}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {session.post?.content || "No description"}
                      </p>
                      
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center">
                          <div className="flex -space-x-2 mr-2">
                            {session.participants?.slice(0, 3).map(participant => (
                              <AvatarWithEmotion
                                key={participant.user_id} 
                                user={participant}
                                size="sm"
                                className="w-6 h-6 border border-white dark:border-gray-800"
                              />
                            ))}
                            
                            {session.participants && session.participants.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/30 border border-white dark:border-gray-800 flex items-center justify-center">
                                <span className="text-xs text-purple-800 dark:text-purple-300">+{session.participants.length - 3}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-gray-500 dark:text-gray-400">
                            {session.participants?.length || 0} participants
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {isSessionActive(session) ? (
                        <Button className="w-full bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Join Now
                        </Button>
                      ) : (
                        <Button variant="outline" className="w-full">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Joined
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Past Tab */}
          <TabsContent value="past">
            {pastLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : filterSessionsBySearch(pastSessions).length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No past sessions</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery 
                    ? "No past sessions match your search."
                    : "You don't have any past shadow sessions."}
                </p>
                {searchQuery && (
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filterSessionsBySearch(pastSessions).map(session => (
                  <Card key={session.post_id} className="bg-white dark:bg-gray-800 opacity-80">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold">{session.title}</h3>
                        <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                          {format(parseISO(session.starts_at), "MMM d")}
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {format(parseISO(session.starts_at), "h:mm a")} - {format(parseISO(session.ends_at), "h:mm a")}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center mb-3">
                        <AvatarWithEmotion 
                          user={session.creator || { user_id: "", profile: { display_name: "Unknown" } }}
                          size="sm"
                          className="mr-2"
                        />
                        <span className="text-sm font-medium">{session.creator?.profile?.display_name}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {session.post?.content || "No description"}
                      </p>
                      
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center">
                          <span className="text-gray-500 dark:text-gray-400">
                            {session.participants?.length || 0} participants
                          </span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full">
                        View Session
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default ShadowSessionsPage;
