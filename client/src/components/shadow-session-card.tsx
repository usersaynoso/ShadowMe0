import { FC, useState } from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { EmotionBadge } from "@/components/ui/emotion-badge";
import { Input } from "@/components/ui/input";
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Layers,
  MoreHorizontal,
  Globe,
  Users,
  CalendarDays,
  Clock,
  PlusCircle
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Post, Comment, User, Emotion, ShadowSession } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShadowSessionChat } from "@/components/shadow-session-chat";
import { Link } from "wouter";

interface ShadowSessionCardProps {
  post: Post & { shadow_session: ShadowSession };
  emotions: Emotion[];
}

export const ShadowSessionCard: FC<ShadowSessionCardProps> = ({ post, emotions }) => {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");

  // Get the shadow session details
  const shadowSession = post.shadow_session;
  
  // Format dates
  const formattedStartDate = format(new Date(shadowSession.starts_at), "EEEE, h:mm a");
  const startDate = new Date(shadowSession.starts_at);
  const endDate = new Date(shadowSession.ends_at);
  
  // Calculate if session is active now
  const now = new Date();
  const isActive = now >= startDate && now <= endDate;
  
  // Get participants
  const { data: participants = [] } = useQuery<User[]>({
    queryKey: ['/api/shadow-sessions', shadowSession.post_id, 'participants'],
  });

  // Join session mutation
  const joinSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/shadow-sessions/${shadowSession.post_id}/join`);
    },
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/shadow-sessions', shadowSession.post_id, 'participants'] });
      
      // Snapshot the previous value
      const previousParticipants = queryClient.getQueryData(['/api/shadow-sessions', shadowSession.post_id, 'participants']);
      
      // Optimistically update to the new value
      if (user && !participants.some(p => p.user_id === user.user_id)) {
        queryClient.setQueryData(
          ['/api/shadow-sessions', shadowSession.post_id, 'participants'],
          [...participants, user]
        );
      }
      
      // Return the snapshot
      return { previousParticipants };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousParticipants) {
        queryClient.setQueryData(
          ['/api/shadow-sessions', shadowSession.post_id, 'participants'],
          context.previousParticipants
        );
      }
      console.error('Failed to join session:', err);
    },
    onSuccess: () => {
      // Invalidate and refetch to get the accurate data
      queryClient.invalidateQueries({ queryKey: ['/api/shadow-sessions', shadowSession.post_id, 'participants'] });
      // Also invalidate the joined sessions list
      queryClient.invalidateQueries({ queryKey: ['/api/shadow-sessions/joined'] });
    }
  });

  // Get audience icon
  const getAudienceIcon = () => {
    switch (post.audience) {
      case 'everyone': return <Globe size={12} className="mr-1" />;
      case 'friends': return <Users size={12} className="mr-1" />;
      default: return <Globe size={12} className="mr-1" />;
    }
  };

  // Get audience display name
  const getAudienceName = () => {
    switch (post.audience) {
      case 'everyone': return 'Everyone';
      case 'friends': return 'Connections';
      case 'friend_group': 
        return post.audienceDetails?.name || 'Circle';
      case 'group': 
        return post.audienceDetails?.name || 'Space';
      default: return 'Everyone';
    }
  };

  // Check if user has already joined
  const hasJoined = participants.some(p => p.user_id === user?.user_id);

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <CardHeader className="p-4">
        <div className="flex items-start space-x-3">
          <AvatarWithEmotion 
            user={post.author}
            emotionOverrides={post.emotion_ids}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{post.author.profile?.display_name}</h3>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs flex items-center">
                  {getAudienceIcon()}
                  {getAudienceName()}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <MoreHorizontal size={16} />
                </Button>
              </div>
            </div>
            
            <div className="flex space-x-2 mt-1">
              {post.emotion_ids.map(id => {
                const emotion = emotions.find(e => e.id === id);
                if (!emotion) return null;
                return (
                  <EmotionBadge 
                    key={emotion.id} 
                    emotion={emotion}
                    selected={true}
                    size="xs"
                  />
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-4 pb-3">
        <div className="p-3 bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-900/20 dark:to-rose-900/20 rounded-lg border border-amber-100 dark:border-amber-800/30 mb-3">
          <div className="flex items-center mb-2">
            <CalendarDays className="text-amber-600 dark:text-amber-400 mr-2 h-4 w-4" />
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">{shadowSession.title}</h3>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-2 text-xs">
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <Clock className="mr-1 h-3 w-3" />
              <span>{formattedStartDate}</span>
            </div>
            
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <Globe className="mr-1 h-3 w-3" />
              <span>{shadowSession.timezone}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Button
              variant={hasJoined ? "secondary" : "default"}
              size="sm"
              className="rounded-md bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 py-1.5 text-xs font-medium"
              onClick={() => joinSessionMutation.mutate()}
              disabled={joinSessionMutation.isPending || hasJoined}
            >
              {hasJoined ? "Joined" : isActive ? "Join Now" : "Join Session"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="rounded-md bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 py-1.5 text-xs font-medium"
            >
              Add to Calendar
            </Button>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex -space-x-2">
              {participants.slice(0, 3).map(participant => (
                <AvatarWithEmotion 
                  key={participant.user_id}
                  user={participant}
                  size="sm"
                  className="w-6 h-6 border border-white dark:border-gray-800"
                />
              ))}
              
              {participants.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-800/30 border border-white dark:border-gray-800 flex items-center justify-center">
                  <span className="text-xs text-amber-800 dark:text-amber-300">+{participants.length - 3}</span>
                </div>
              )}
            </div>
            <span className="text-gray-500 dark:text-gray-400">{participants.length} participants</span>
          </div>
        </div>
        
        {isActive && (
          <Tabs defaultValue="description" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="description">About</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="pt-4">
              <p className="text-sm">{post.content}</p>
            </TabsContent>
            <TabsContent value="chat" className="pt-4 h-72">
              <ShadowSessionChat sessionId={shadowSession.post_id} isActive={isActive} />
            </TabsContent>
          </Tabs>
        )}

        {!isActive && (
          <p className="text-sm">{post.content}</p>
        )}
      </CardContent>
      
      <CardFooter className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <div className="flex space-x-4">
          <Button 
            variant="ghost"
            size="sm"
            className="flex items-center text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 px-2"
          >
            <Heart className="mr-1.5 h-4 w-4" />
            <span className="text-xs">{post.reactions_count || 0}</span>
          </Button>
          
          <Button 
            variant="ghost"
            size="sm"
            className="flex items-center text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 px-2"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" />
            <span className="text-xs">0</span>
          </Button>
        </div>
        
        <Link href={`/shadow-sessions/${shadowSession.post_id}`}>
          <Button 
            variant="outline"
            size="sm"
            className="text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-800"
          >
            View Details
          </Button>
        </Link>
      </CardFooter>
      
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <AvatarWithEmotion 
            user={user!}
            size="sm"
          />
          
          <div className="flex-1 relative">
            <Input
              type="text"
              className="w-full rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <Button 
              variant="ghost"
              size="sm"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary-600 dark:text-primary-400"
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
