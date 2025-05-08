import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/main-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Loader2, Globe, Lock, Tag, UserPlus, LogOut, PenSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Group, Post, User, Emotion } from "@/types";
import { useState } from "react";
import { MediaGallery } from "@/components/ui/media-gallery";
import { PostCard } from "@/components/post-card";
import { CreatePostDialog } from "@/components/create-post-dialog";

export default function SpaceViewPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAllMembers, setShowAllMembers] = useState(false);

  // Get all emotions
  const { data: emotions = [] } = useQuery<Emotion[]>({
    queryKey: ['/api/emotions'],
  });

  // Fetch space details
  const { data: space, isLoading: spaceLoading, error: spaceError } = useQuery<Group>({
    queryKey: ["/api/groups", spaceId],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/groups/${spaceId}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error("Error fetching space details:", res.status, errorData);
          throw new Error(errorData.message || `Error ${res.status}: Failed to load space details`);
        }
        return res.json();
      } catch (err) {
        console.error("Error in space fetch:", err);
        throw err;
      }
    },
    enabled: !!spaceId,
  });

  // Fetch space members
  const { data: members = [], isLoading: membersLoading } = useQuery<User[]>({
    queryKey: ["/api/groups", spaceId, "members"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/groups/${spaceId}/members`);
      return res.json();
    },
    enabled: !!spaceId,
  });

  // Fetch posts for this space
  const { data: posts = [], isLoading: postsLoading, refetch: refetchPosts, isFetching: postsFetching } = useQuery<Post[]>({
    queryKey: ["/api/posts", { parent_type: "group", parent_id: spaceId }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/posts?parent_type=group&parent_id=${spaceId}`);
      return res.json();
    },
    enabled: !!spaceId,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Join/leave mutations
  const joinMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/groups/${spaceId}/join`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", spaceId, "members"] });
    },
  });
  const leaveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/groups/${spaceId}/member`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", spaceId, "members"] });
    },
  });

  // Handle post update
  const handlePostUpdate = () => {
    console.log('Space post updated, refreshing...');
    refetchPosts();
  };

  // Check if user is a member
  const isMember = members.some((m) => m.user_id === user?.user_id);

  if (spaceLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
        </div>
      </MainLayout>
    );
  }
  
  if (spaceError || !space) {
    return (
      <MainLayout>
        <Card className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <h3 className="text-lg font-medium mb-2">Space not found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {spaceError ? 
              `Error: ${spaceError.message}` : 
              "This space does not exist or you do not have access."}
          </p>
          <div className="text-xs text-gray-400 mt-4">
            Debug info: Looking for space ID: {spaceId}
          </div>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Space info card */}
        <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">{space.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {space.is_public ? (
                    <span className="flex items-center text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                      <Globe className="h-3 w-3 mr-1" /> Public
                    </span>
                  ) : (
                    <span className="flex items-center text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                      <Lock className="h-3 w-3 mr-1" /> Private
                    </span>
                  )}
                  {space.topic_tag && (
                    <span className="flex items-center text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                      <Tag className="h-3 w-3 mr-1" /> {space.topic_tag}
                    </span>
                  )}
                </div>
                <CardDescription className="mt-2">{space.description}</CardDescription>
              </div>
              <div>
                {isMember ? (
                  <Button variant="outline" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
                    <LogOut className="h-4 w-4 mr-1" /> Leave
                  </Button>
                ) : (
                  <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
                    <UserPlus className="h-4 w-4 mr-1" /> Join
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">{space.memberCount ?? members.length} members</span>
              <div className="flex -space-x-2">
                {members.slice(0, 5).map((member) => (
                  <AvatarWithEmotion key={member.user_id} user={member} size="sm" className="border-2 border-white dark:border-gray-800" />
                ))}
                {members.length > 5 && !showAllMembers && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllMembers(true)}>
                    +{members.length - 5} more
                  </Button>
                )}
              </div>
            </div>
            {showAllMembers && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center gap-2">
                    <AvatarWithEmotion user={member} size="sm" />
                    <span>{member.profile?.display_name || member.email}</span>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setShowAllMembers(false)}>
                  Show less
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Post Card - Show only if user is a member */}
        {isMember && (
          <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <div className="flex items-center space-x-3 mb-4">
              <AvatarWithEmotion user={user!} />
              
              <Button 
                variant="outline"
                className="w-full text-left rounded-full bg-gray-100 dark:bg-gray-700 px-4 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 justify-start"
                onClick={() => document.getElementById('create-space-post-trigger')?.click()}
              >
                Share something with this space...
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2 md:gap-3">
              <CreatePostDialog onEditSuccess={handlePostUpdate}>
                <Button 
                  id="create-space-post-trigger" 
                  className="rounded-full px-4 py-2 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm flex items-center hover:bg-primary-100 dark:hover:bg-primary-800/40"
                >
                  <PenSquare className="mr-2 h-4 w-4" />
                  Create Post
                </Button>
              </CreatePostDialog>
            </div>
          </Card>
        )}

        {/* Posts Feed */}
        <div className="space-y-6">
          <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Posts in this Space</CardTitle>
            </CardHeader>
            
            {postsLoading ? (
              <CardContent>
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                </div>
              </CardContent>
            ) : posts.length === 0 ? (
              <CardContent>
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <p className="mb-2">No posts yet in this space.</p>
                  {isMember && (
                    <p className="text-sm">Be the first to start a conversation!</p>
                  )}
                </div>
              </CardContent>
            ) : (
              <CardContent>
                {/* Refreshing indicator */}
                {postsFetching && !postsLoading && (
                  <div className="flex justify-center items-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg mb-4 text-sm animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Refreshing posts...</span>
                  </div>
                )}
                
                <div className="space-y-6">
                  {posts.map((post) => (
                    <PostCard 
                      key={post.post_id} 
                      post={post}
                      emotions={emotions}
                      onPostUpdated={handlePostUpdate}
                    />
                  ))}
                </div>
                
                {posts.length >= 10 && (
                  <div className="flex justify-center mt-6">
                    <Button 
                      variant="outline"
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
} 