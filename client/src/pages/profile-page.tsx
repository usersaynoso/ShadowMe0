import { FC, useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { PostCard } from "@/components/post-card";
import { ShadowSessionCard } from "@/components/shadow-session-card";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";
import { ConnectionRequestButton } from "@/components/connection-request-button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User, Post, Emotion } from "@/types";
import { Loader2, Settings, Calendar, Edit3, MessageCircle, Camera, PenSquare } from "lucide-react";

const ProfilePage: FC = () => {
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
  const { data: userPosts = [], isLoading: postsLoading, refetch: refetchUserPosts, isFetching: postsFetching } = useQuery<Post[]>({
    queryKey: [`/api/users/${userId}/posts`],
    enabled: !!userId,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Function to handle post updates
  const handlePostUpdate = () => {
    console.log('Profile post updated, refreshing...');
    refetchUserPosts();
  };

  // Filter posts by type
  const posts = userPosts.filter(post => !post.shadow_session);
  const shadowSessions = userPosts.filter(post => post.shadow_session);

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
        <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <h3 className="text-lg font-medium mb-2">User not found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The user profile you're looking for doesn't exist or you don't have permission to view it.
          </p>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Main content here, centered */}
      {/* Profile Header */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="h-32 bg-gradient-to-r from-primary-200 to-primary-100 dark:from-primary-900 dark:to-primary-800"></div>
        <div className="px-6 pb-6 relative">
          <div className="absolute -top-10 left-6 flex items-end">
            <AvatarWithEmotion 
              user={profileUser} 
              size="lg"
              className="border-4 border-white dark:border-gray-800 shadow-md"
            />
          </div>
          
          <div className="mt-12 flex flex-col md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {profileUser.profile?.display_name}
              </h1>
              <div className="text-gray-500 dark:text-gray-400 text-sm flex items-center space-x-2">
                <span>@{profileUser.email.split('@')[0]}</span>
                <span>•</span>
                <span>Connected since {new Date(profileUser.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            
            {isOwnProfile ? (
              <div className="mt-4 md:mt-0 flex space-x-2">
                <ProfileEditDialog>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit Profile
                  </Button>
                </ProfileEditDialog>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-full"
                  onClick={() => alert("Coming Soon!")}
                  title="Coming Soon!"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Settings
                </Button>
              </div>
            ) : (
              <div className="mt-4 md:mt-0 flex space-x-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="rounded-full"
                  onClick={() => alert("Coming Soon!")}
                  title="Coming Soon!"
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Message
                </Button>
                <ConnectionRequestButton 
                  targetUser={profileUser} 
                  size="sm" 
                  variant="outline"
                  className="rounded-full"
                />
              </div>
            )}
          </div>
          
          {profileUser.profile?.bio && (
            <p className="mt-4 text-sm">{profileUser.profile.bio}</p>
          )}
        </div>
      </Card>
      
      {/* Profile Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
          <TabsTrigger value="posts" className="flex-1">Posts</TabsTrigger>
          <TabsTrigger value="shadow-sessions" className="flex-1">Shadow Sessions</TabsTrigger>
          <TabsTrigger value="media" className="flex-1">Media</TabsTrigger>
        </TabsList>
        
        {/* Posts Tab */}
        <TabsContent value="posts">
          {postsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
            </div>
          ) : posts.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
              <h3 className="text-lg font-medium mb-2">No posts yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {isOwnProfile 
                  ? "Share your thoughts and feelings with your first post!"
                  : "This user hasn't posted anything yet."}
              </p>
              {isOwnProfile && (
                <Button 
                  variant="default"
                  onClick={() => document.getElementById('create-post-trigger')?.click()}
                >
                  <PenSquare className="mr-2 h-4 w-4" />
                  Create Post
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Refreshing indicator */}
              {postsFetching && !postsLoading && (
                <div className="flex justify-center items-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg mb-4 text-sm animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Refreshing posts...</span>
                </div>
              )}
              
              {posts.map(post => (
                <PostCard 
                  key={post.post_id}
                  post={post}
                  emotions={emotions}
                  onPostUpdated={handlePostUpdate}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Shadow Sessions Tab */}
        <TabsContent value="shadow-sessions">
          {postsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
            </div>
          ) : shadowSessions.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
              <h3 className="text-lg font-medium mb-2">No shadow sessions yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {isOwnProfile 
                  ? "Create your first shadow session to connect more deeply!"
                  : "This user hasn't created any shadow sessions yet."}
              </p>
              {isOwnProfile && (
                <Button 
                  variant="default"
                  onClick={() => document.getElementById('create-post-trigger')?.click()}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Create Shadow Session
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Refreshing indicator */}
              {postsFetching && !postsLoading && (
                <div className="flex justify-center items-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg mb-4 text-sm animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Refreshing shadow sessions...</span>
                </div>
              )}
              
              {shadowSessions.map(post => (
                <ShadowSessionCard 
                  key={post.post_id}
                  post={{...post, shadow_session: post.shadow_session!}}
                  emotions={emotions}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Media Tab */}
        <TabsContent value="media">
          <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
            <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No media yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {isOwnProfile 
                ? "Share your first photo or media to your profile!"
                : "This user hasn't shared any media yet."}
            </p>
            {isOwnProfile && (
              <Button 
                variant="default"
                onClick={() => document.getElementById('create-post-trigger')?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                Share Photo
              </Button>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default ProfilePage; 