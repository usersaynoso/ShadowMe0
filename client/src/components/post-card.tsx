import { FC, useState } from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { AvatarWithRing } from "@/components/ui/avatar-with-ring";
import { EmotionBadge } from "@/components/ui/emotion-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Layers,
  MoreHorizontal,
  Globe,
  Users,
  Lock
} from "lucide-react";
import { Post, Comment, User, Emotion } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MediaGallery } from "@/components/ui/media-gallery";

interface PostCardProps {
  post: Post;
  emotions: Emotion[];
}

export const PostCard: FC<PostCardProps> = ({ post, emotions }) => {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");

  // Get comments for this post
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ['/api/posts', post.post_id, 'comments'],
  });

  // Check if current user has liked this post
  const { data: userReaction } = useQuery({
    queryKey: ['/api/posts', post.post_id, 'reaction', user?.user_id],
    enabled: !!user?.user_id,
  });

  // Like/unlike post mutation
  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      if (userReaction && typeof userReaction === 'object' && 'reaction_id' in userReaction) {
        return apiRequest('DELETE', `/api/posts/${post.post_id}/reactions/${userReaction.reaction_id}`);
      } else {
        return apiRequest('POST', `/api/posts/${post.post_id}/reactions`, {
          reaction_type: 'like'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts', post.post_id, 'reaction', user?.user_id] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      return apiRequest('POST', `/api/posts/${post.post_id}/comments`, { body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts', post.post_id, 'comments'] });
      setCommentText("");
    }
  });

  const handleAddComment = () => {
    if (commentText.trim()) {
      addCommentMutation.mutate(commentText);
    }
  };

  // Get audience icon
  const getAudienceIcon = () => {
    switch (post.audience) {
      case 'everyone': return <Globe size={12} className="mr-1" />;
      case 'friends': return <Users size={12} className="mr-1" />;
      case 'just_me': return <Lock size={12} className="mr-1" />;
      case 'friend_group': return <Users size={12} className="mr-1" />;
      case 'group': return <Users size={12} className="mr-1" />;
      default: return <Globe size={12} className="mr-1" />;
    }
  };

  // Get audience display name
  const getAudienceName = () => {
    switch (post.audience) {
      case 'everyone': return 'Everyone';
      case 'friends': return 'Connections';
      case 'just_me': return 'Just Me';
      case 'friend_group': 
        return post.audienceDetails?.name || 'Circle';
      case 'group': 
        return post.audienceDetails?.name || 'Space';
      default: return 'Everyone';
    }
  };

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <CardHeader className="p-4">
        <div className="flex items-start space-x-3">
          <AvatarWithRing 
            user={post.author}
            emotionIds={post.emotion_ids}
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
        <p className="text-sm mb-3">{post.content}</p>
        
        {post.media && post.media.length > 0 && (
          <MediaGallery media={post.media} className="mt-3" />
        )}
      </CardContent>
      
      <CardFooter className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <div className="flex space-x-4">
          <Button 
            variant="ghost"
            size="sm"
            className="flex items-center text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 px-2"
            onClick={() => toggleLikeMutation.mutate()}
          >
            {userReaction && typeof userReaction === 'object' && 'reaction_id' in userReaction ? (
              <Heart className="mr-1.5 h-4 w-4 fill-red-500 text-red-500" />
            ) : (
              <Heart className="mr-1.5 h-4 w-4" />
            )}
            <span className="text-xs">{post.reactions_count || 0}</span>
          </Button>
          
          <Button 
            variant="ghost"
            size="sm"
            className="flex items-center text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 px-2"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" />
            <span className="text-xs">{comments.length || 0}</span>
          </Button>
        </div>
        
        <Button 
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 px-2"
        >
          <Bookmark className="h-4 w-4" />
        </Button>
      </CardFooter>
      
      {comments.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
          {comments.slice(0, 2).map(comment => (
            <div key={comment.comment_id} className="flex items-start space-x-3 mb-3">
              <AvatarWithRing 
                user={comment.author}
                size="sm"
              />
              
              <div className="flex-1">
                <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-xs">{comment.author.profile?.display_name}</h4>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs mt-1">{comment.body}</p>
                </div>
                
                <div className="flex mt-1 ml-1 space-x-2 text-xs text-gray-500">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs">Like</Button>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs">Reply</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <AvatarWithRing 
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
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <Button 
              variant="ghost"
              size="sm"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary-600 dark:text-primary-400"
              onClick={handleAddComment}
              disabled={!commentText.trim() || addCommentMutation.isPending}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
