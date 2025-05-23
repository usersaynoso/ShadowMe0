import { FC, useState } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PostCard } from "@/components/post-card";
import { ShadowSessionCard } from "@/components/shadow-session-card";
import { CreatePostDialog } from "@/components/create-post-dialog";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { EmotionSelector, Emotion } from "@/components/ui/emotion-selector";
import { useAuth } from "@/hooks/use-auth";
import { Post, ShadowSession } from "@/types";
import { PenSquare, Camera, CalendarDays, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const HomePage: FC = () => {
  const { user } = useAuth();
  
  // Get all emotions
  const { data: emotions = [] } = useQuery<Emotion[]>({
    queryKey: ['/api/emotions'],
  });
  
  // Get posts (no emotion filter)
  const { data: posts = [], isLoading: postsLoading, refetch: refetchPosts, isFetching: postsFetching } = useQuery<Post[]>({
    queryKey: ['/api/posts'],
    refetchOnMount: true,
    staleTime: 0,
  });

  // Add function to handle post creation/edit completion
  const handlePostUpdate = () => {
    console.log('Post updated, refreshing feed...');
    refetchPosts();
  };

  return (
    <MainLayout>
      {/* Create Post Card */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <AvatarWithEmotion user={user!} />
          
          <Button 
            variant="outline"
            className="w-full text-left rounded-full bg-gray-100 dark:bg-gray-700 px-4 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 justify-start"
            onClick={() => document.getElementById('create-post-trigger')?.click()}
          >
            How are you feeling today?
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2 md:gap-3">
          <CreatePostDialog onEditSuccess={handlePostUpdate}>
            <Button id="create-post-trigger" className="rounded-full px-4 py-2 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm flex items-center hover:bg-primary-100 dark:hover:bg-primary-800/40">
              <PenSquare className="mr-2 h-4 w-4" />
              Create Post
            </Button>
          </CreatePostDialog>
          
          <Button 
            className="rounded-full px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm flex items-center hover:bg-green-100 dark:hover:bg-green-800/40"
            onClick={() => alert("Coming Soon!")}
            title="Coming Soon!"
          >
            <Camera className="mr-2 h-4 w-4" />
            Photo
          </Button>
          
          <CreatePostDialog onEditSuccess={handlePostUpdate}>
            <Button className="rounded-full px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm flex items-center hover:bg-purple-100 dark:hover:bg-purple-800/40">
              <CalendarDays className="mr-2 h-4 w-4" />
              Shadow Session
            </Button>
          </CreatePostDialog>
        </div>
      </Card>
      
      {/* Posts Feed */}
      <div className="space-y-6">
        {postsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
            <h3 className="text-lg font-medium mb-2">No posts yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Be the first to share your thoughts and feelings!
            </p>
          </Card>
        ) : (
          <>
            {/* Refreshing indicator */}
            {postsFetching && !postsLoading && (
              <div className="flex justify-center items-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg mb-4 text-sm animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Refreshing posts...</span>
              </div>
            )}
            
            {posts.map(post => {
              if (post.shadow_session) {
                return (
                  <ShadowSessionCard 
                    key={post.post_id} 
                    post={{...post, shadow_session: post.shadow_session}}
                    emotions={emotions}
                  />
                );
              }
              return (
                <PostCard 
                  key={post.post_id} 
                  post={post}
                  emotions={emotions}
                  onPostUpdated={handlePostUpdate}
                />
              );
            })}
            
            {posts.length >= 10 && (
              <div className="flex justify-center">
                <Button 
                  variant="outline"
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                  onClick={() => alert("Coming Soon!")}
                  title="Coming Soon!"
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default HomePage;
