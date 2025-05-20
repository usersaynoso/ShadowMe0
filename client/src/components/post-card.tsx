import { FC, useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { AvatarWithRing } from "@/components/ui/avatar-with-ring";
import { EmotionBadge } from "@/components/ui/emotion-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Layers,
  MoreHorizontal,
  Globe,
  Users,
  Lock,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Flag,
  Copy,
  Link,
  Check,
  Handshake,
  ShieldCheck,
  HelpingHand,
  Smile
} from "lucide-react";
import { Post, Comment, User, Emotion, Reaction, ReactionType, REACTION_OPTIONS } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MediaGallery } from "@/components/ui/media-gallery";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreatePostDialog } from "@/components/create-post-dialog";

interface PostCardProps {
  post: Post;
  emotions: Emotion[];
  onPostUpdated?: () => void; // Optional callback to notify parent when post is updated
}

export const PostCard: FC<PostCardProps> = ({ post, emotions, onPostUpdated }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [currentUserReaction, setCurrentUserReaction] = useState<Reaction | null>(null);
  const [localReactionCount, setLocalReactionCount] = useState(post.reactions_count || 0);
  const [isVisible, setIsVisible] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showCommentSection, setShowCommentSection] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Get comments for this post - use full API URL path in the queryKey
  const { data: comments = [], refetch: refetchComments } = useQuery<Comment[]>({
    queryKey: [`/api/posts/${post.post_id}/comments`],
    enabled: !!post.post_id, // Only run query if post_id exists
  });

  // Check if current user has liked this post
  const { data: userReactionData, refetch: refetchUserReaction } = useQuery<Reaction | null>({
    queryKey: [`/api/posts/${post.post_id}/reaction/${user?.user_id}`],
    enabled: !!user?.user_id && !!post.post_id,
  });

  // Update local state when userReactionData changes
  useEffect(() => {
    if (userReactionData && userReactionData.reaction_id) {
      setCurrentUserReaction(userReactionData);
      // Ensure localReactionCount reflects an existing reaction if not already counted by post.reactions_count
      // This logic might need refinement based on how post.reactions_count is updated server-side after a reaction.
    } else {
      setCurrentUserReaction(null);
    }
  }, [userReactionData]);

  // Memoize reaction options with actual icons
  const reactionOptionsWithIcons = useMemo(() => {
    return REACTION_OPTIONS.map(opt => {
      let IconComponent = Layers; // Default icon for safety, can be any sensible default
      switch (opt.icon) {
        case 'Heart': IconComponent = Heart; break;
        case 'Handshake': IconComponent = Handshake; break;
        case 'ShieldCheck': IconComponent = ShieldCheck; break;
        case 'HelpingHand': IconComponent = HelpingHand; break;
        case 'Smile': IconComponent = Smile; break;
        // Default case will use Layers icon
      }
      return { ...opt, IconComponent }; 
    });
  }, []);

  // Like/unlike post mutation
  const submitReactionMutation = useMutation<
    Reaction, // Expected response type
    Error,
    { reactionType: ReactionType } // Variables type
  >({
    mutationFn: async ({ reactionType }) => {
      const oldReaction = currentUserReaction;
      // Optimistic Update
      const optimisticReaction: Reaction = {
        reaction_id: oldReaction?.reaction_id || Date.now(), // Temporary ID if new reaction
        post_id: post.post_id,
        user_id: user!.user_id, // Assuming user is always defined here due to component logic/auth
        reaction_type: reactionType,
        created_at: new Date().toISOString(),
      };
      setCurrentUserReaction(optimisticReaction);
      if (!oldReaction) {
        setLocalReactionCount(prev => prev + 1);
      } // If reaction type is just changing, count remains same until server confirm

      try {
        const response = await apiRequest('POST', `/api/posts/${post.post_id}/reactions`, {
          reaction_type: reactionType
        });
        // apiRequest returns a Response object, so we need to .json() it
        const newReactionData = await response.json(); 
        return newReactionData as Reaction; // Assert the type of the JSON data
      } catch (error) {
        // Revert optimistic update on actual API error
        setCurrentUserReaction(oldReaction);
        if (!oldReaction) {
          setLocalReactionCount(prev => Math.max(0, prev - 1));
        }
        throw error; // Re-throw to be caught by mutation's onError
      }
    },
    onSuccess: (data) => { // data here is the actual Reaction object from the server
      setCurrentUserReaction(data);
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.post_id}/reaction/${user?.user_id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.post_id}`] }); // For post details like reaction count
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] }); // For overall feed
      // No need to manually refetchUserReaction, invalidation handles it.
      // Also, refetch the comments if the reaction might influence comment display or count indirectly.
      // refetchComments(); // Uncomment if necessary
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit reaction.", variant: "destructive" });
      // Reversion is handled in mutationFn's catch block for optimistic updates
    }
  });

  const deleteReactionMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!currentUserReaction) return;
      const oldReaction = currentUserReaction;
      setCurrentUserReaction(null);
      setLocalReactionCount(prev => Math.max(0, prev - 1));

      try {
        await apiRequest('DELETE', `/api/posts/${post.post_id}/reactions/${oldReaction.reaction_id}`);
      } catch (error) {
        setCurrentUserReaction(oldReaction);
        setLocalReactionCount(prev => prev + 1);
        throw error;
      }
    },
    onSuccess: () => {
      setCurrentUserReaction(null);
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.post_id}/reaction/${user?.user_id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.post_id}`] });
      refetchUserReaction();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove reaction.", variant: "destructive" });
    }
  });

  const handleReactionSelect = (reactionType: ReactionType) => {
    if (currentUserReaction?.reaction_type === reactionType) {
      // User clicked the same reaction again, so delete it
      deleteReactionMutation.mutate();
    } else {
      // User selected a new reaction or changed reaction
      submitReactionMutation.mutate({ reactionType });
    }
  };

  // To render the current reaction icon (if any)
  const CurrentReactionIcon = useMemo(() => {
    if (!currentUserReaction) return null;
    const option = reactionOptionsWithIcons.find(opt => opt.type === currentUserReaction.reaction_type);
    return option ? option.IconComponent : null;
  }, [currentUserReaction, reactionOptionsWithIcons]);

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      return apiRequest('POST', `/api/posts/${post.post_id}/comments`, { body });
    },
    onSuccess: async () => {
      // Directly refetch comments to ensure immediate update
      await refetchComments();
      
      // Also invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      
      setCommentText("");
      // Show all comments after adding a new one
      setShowAllComments(true);
    }
  });

  const handleAddComment = () => {
    if (commentText.trim()) {
      addCommentMutation.mutate(commentText);
    }
  };

  // Add reply mutation (to be implemented next)
  const addReplyMutation = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      // The new endpoint for replies
      return apiRequest('POST', `/api/comments/${commentId}/replies`, { body });
    },
    onSuccess: async () => {
      await refetchComments();
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] }); // Invalidate posts to update comment counts potentially
      setReplyText("");
      setReplyingToCommentId(null);
      toast({ title: "Reply posted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to post reply.", variant: "destructive" });
    }
  });

  const handleAddReply = (commentId: string) => {
    if (replyText.trim()) {
      addReplyMutation.mutate({ commentId, body: replyText });
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

  // Sort comments with most recent first
  const sortedComments = [...comments].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Structure comments into a nested map for rendering replies
  const commentsById = useMemo(() => {
    const map: Record<string, Comment> = {};
    comments.forEach(comment => {
      map[comment.comment_id] = comment;
    });
    return map;
  }, [comments]);

  const nestedComments = useMemo(() => {
    const topLevelComments: Comment[] = [];
    const repliesMap: Record<string, Comment[]> = {};

    // Prioritize sorting before nesting
    const currentSortedComments = [...comments].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime() // oldest first for parent-child ordering
    );

    currentSortedComments.forEach(comment => {
      if (comment.parent_comment_id) {
        if (!repliesMap[comment.parent_comment_id]) {
          repliesMap[comment.parent_comment_id] = [];
        }
        repliesMap[comment.parent_comment_id].push(comment);
      } else {
        topLevelComments.push(comment);
      }
    });
    // Sort top-level comments by most recent
    topLevelComments.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    // Sort replies by oldest first (or keep API order if it is already chronological for replies)
    Object.values(repliesMap).forEach(replyList => replyList.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));


    return { topLevelComments, repliesMap };
  }, [comments]);

  // Get comments to display based on showAllComments state
  // This will now use nestedComments for rendering
  const commentsToDisplay = showAllComments 
    ? nestedComments.topLevelComments 
    : nestedComments.topLevelComments.slice(0, 1);

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async () => {
      // Optimistically update UI by hiding the post
      // setIsVisible(false); // Moved to onSuccess of the mutation for confirmed deletion
      
      console.log(`Attempting to delete post ${post.post_id}`);
      
      // Send a simple DELETE request with minimal headers
      const response = await fetch(`/api/posts/${post.post_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      // Log the raw response
      console.log(`Delete response status: ${response.status}`);
      
      // If the response is not ok, throw an error to trigger the onError handler
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Deletion error: ${errorText}`);
        // setIsVisible(true); // Revert optimistic update if error occurs before onSuccess
        throw new Error(errorText || 'Failed to delete post');
      }
      
      return response; // Or response.json() if the server sends a body
    },
    onSuccess: () => {
      console.log(`Successfully deleted post ${post.post_id}, invalidating queries`);
      setIsVisible(false); // Optimistic/Confirmed hide
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.user_id}/posts`] });
      
      // Show success toast
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully.",
      });
    },
    onError: (error) => {
      console.error(`Failed to delete post ${post.post_id}:`, error);
      
      // Show error toast
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
      
      // Revert visibility since deletion failed
      setIsVisible(true);
    }
  });

  // Handle post actions
  const handleDeletePost = async () => {
    console.log(`Handling delete for post ${post.post_id}`);
    
    if (confirm('Are you sure you want to delete this post?')) {
      console.log(`Delete confirmed for post ${post.post_id}`);
      deletePostMutation.mutate();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.post_id}`);
    toast({
      title: "Link copied",
      description: "Link has been copied to clipboard.",
    });
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(post.content || '');
    toast({
      title: "Text copied",
      description: "Post text has been copied to clipboard.",
    });
  };

  const handleEditPost = () => {
    setEditingPost(post);
    setEditDialogOpen(true);
  };

  const handleReportPost = () => {
    // Placeholder for report post functionality
    toast({
      title: "Coming Soon",
      description: "Report functionality will be available soon!",
      variant: "default",
    });
  };

  // Check if current user is the author of the post
  const isAuthor = user?.user_id === post.author.user_id;
  const [isDeleting, setIsDeleting] = useState(false);

  // Show a deleted state if the post is being deleted
  useEffect(() => {
    if (deletePostMutation.isPending) {
      setIsDeleting(true);
    }
  }, [deletePostMutation.isPending]);

  // If the post is being deleted, show a loading state
  if (isDeleting) {
    return (
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden opacity-60">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">Deleting post...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If post has been deleted (optimistically or confirmed), don't render it
  if (!isVisible) {
    return null;
  }

  const handleToggleCommentSection = () => {
    setShowCommentSection(prev => !prev);
    // Optionally, refetch comments when opening the section if they might be stale
    // if (!showCommentSection) {
    //   refetchComments();
    // }
  };

  return (
    <>
      <CreatePostDialog
        postToEdit={editingPost || undefined}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingPost(null);
        }}
        onEditSuccess={(updatedPost) => {
          console.log("Post successfully updated, refreshing data...");
          queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
          queryClient.invalidateQueries({ 
            queryKey: [`/api/users/${post.author.user_id}/posts`],
            exact: false
          });
          queryClient.refetchQueries({
            queryKey: ['/api/posts'],
            type: 'active'
          });
          if (onPostUpdated) {
            onPostUpdated();
          }
        }}
      />
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {isAuthor && (
                        <>
                          <DropdownMenuItem className="cursor-pointer" onClick={handleEditPost}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Edit post</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-red-500 hover:text-red-600 focus:text-red-600" onClick={handleDeletePost}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete post</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem className="cursor-pointer" onClick={handleCopyLink}>
                        <Link className="mr-2 h-4 w-4" />
                        <span>Copy link</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={handleCopyText}>
                        <Copy className="mr-2 h-4 w-4" />
                        <span>Copy text</span>
                      </DropdownMenuItem>
                      {!isAuthor && (
                        <DropdownMenuItem className="cursor-pointer text-orange-500 hover:text-orange-600 focus:text-orange-600" onClick={handleReportPost}>
                          <Flag className="mr-2 h-4 w-4" />
                          <span>Report post</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
          <p className="text-sm mb-3 break-words break-all whitespace-pre-line">{post.content}</p>
          
          {post.media && post.media.length > 0 && (
            <MediaGallery media={post.media} className="mt-3" />
          )}
        </CardContent>
        
        <CardFooter className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-start items-center">
          <div className="flex space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost"
                  size="sm"
                  className="flex items-center text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 px-2"
                >
                  {CurrentReactionIcon ? (
                    <CurrentReactionIcon className="mr-1.5 h-4 w-4 text-primary-500" /> // Example styling
                  ) : (
                    <Heart className="mr-1.5 h-4 w-4" /> // Default if no reaction or for placeholder
                  )}
                  <span className="text-xs">Reactions {localReactionCount > 0 ? `(${localReactionCount})` : ''}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>React</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {reactionOptionsWithIcons.map((option) => (
                  <DropdownMenuItem key={option.type} onClick={() => handleReactionSelect(option.type)} className="cursor-pointer">
                    <option.IconComponent className="mr-2 h-4 w-4" />
                    <span>{option.label}</span>
                    {currentUserReaction?.reaction_type === option.type && (
                      <Check className="ml-auto h-4 w-4 text-primary-500" /> // Indicate current selection
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="ghost"
              size="sm"
              className="flex items-center text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 px-2"
              onClick={handleToggleCommentSection}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              <span className="text-xs">Comments {comments.length > 0 ? `(${comments.length})` : ''}</span>
            </Button>
          </div>
        </CardFooter>
        
        {showCommentSection && (
          <>
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

            {comments.length > 0 && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                {commentsToDisplay.map(comment => (
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
                        <div className="flex items-baseline mt-1">
                          <p className="text-xs break-words break-all whitespace-pre-line mr-2">{comment.body}</p>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-xs shrink-0"
                            onClick={() => setReplyingToCommentId(replyingToCommentId === comment.comment_id ? null : comment.comment_id)}
                          >
                            Reply
                          </Button>
                        </div>
                      </div>
                      {/* Render Replies for this comment */}
                      {(nestedComments.repliesMap[comment.comment_id] || []).map(reply => (
                        <div key={reply.comment_id} className="flex items-start space-x-3 mt-2 ml-8"> {/* Indent replies */}
                          <AvatarWithRing 
                            user={reply.author}
                            size="sm"
                          />
                          <div className="flex-1">
                            <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm">
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium text-xs">{reply.author.profile?.display_name}</h4>
                                <span className="text-xs text-gray-500">
                                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <div className="flex items-baseline mt-0.5">
                                <p className="text-xs break-words break-all whitespace-pre-line mr-2">{reply.body}</p>
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="h-auto p-0 text-xs shrink-0"
                                  onClick={() => setReplyingToCommentId(replyingToCommentId === reply.comment_id ? null : reply.comment_id)}
                                >
                                  Reply
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Reply Input Form */}
                      {replyingToCommentId === comment.comment_id && (
                        <div className="mt-2 ml-8 flex items-center space-x-2">
                          <AvatarWithRing user={user!} size="sm" />
                          <Input
                            type="text"
                            className="w-full rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs"
                            placeholder={`Replying to ${comment.author.profile?.display_name}...`}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddReply(comment.comment_id)}
                          />
                          <Button 
                            size="sm"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => handleAddReply(comment.comment_id)}
                            disabled={!replyText.trim() || addReplyMutation.isPending}
                          >
                            Post Reply
                          </Button>
                        </div>
                      )}
                       {/* Reply Input Form for a reply (nested reply) - similar logic */}
                      {(nestedComments.repliesMap[comment.comment_id] || []).map(reply => (
                        replyingToCommentId === reply.comment_id && (
                          <div key={`reply-input-${reply.comment_id}`} className="mt-2 ml-16 flex items-center space-x-2"> {/* Further indent reply input for a reply*/}
                            <AvatarWithRing user={user!} size="sm" />
                            <Input
                              type="text"
                              className="w-full rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs"
                              placeholder={`Replying to ${reply.author.profile?.display_name}...`}
                              value={replyText} // This needs to be specific to this reply context or manage multiple reply inputs
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddReply(reply.comment_id)}
                            />
                            <Button 
                              size="sm"
                              className="px-3 py-1.5 text-xs"
                              onClick={() => handleAddReply(reply.comment_id)}
                              disabled={!replyText.trim() || addReplyMutation.isPending}
                            >
                              Post Reply
                            </Button>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ))}
                
                {comments.length > 1 && (
                  <Button
                    variant="ghost" 
                    size="sm"
                    className="w-full mt-1 text-xs font-medium text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center"
                    onClick={() => setShowAllComments(!showAllComments)}
                  >
                    {showAllComments ? (
                      <>
                        <ChevronUp className="mr-1 h-4 w-4" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1 h-4 w-4" />
                        View all {comments.length} comments
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
};
