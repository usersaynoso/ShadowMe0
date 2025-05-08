import { FC, useState } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FriendGroup, User } from "@/types";
import { Loader2, Search, UserPlus, Users, X, Check, Clock, UserMinus, Heart, BriefcaseBusiness, UserCircle, Plus } from "lucide-react";
import { ConnectionRequestButton } from "@/components/connection-request-button";

const ConnectionsPage: FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [newCircleName, setNewCircleName] = useState("");
  const [newCircleDescription, setNewCircleDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Get user's connections
  const { data: connections = [], isLoading: connectionsLoading } = useQuery<User[]>({
    queryKey: ['/api/user/connections'],
    enabled: !!user,
  });

  // Get pending connection requests
  const { data: pendingRequests = [], isLoading: pendingLoading } = useQuery<User[]>({
    queryKey: ['/api/user/connections/pending'],
    enabled: !!user,
  });

  // Get connection suggestions
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery<User[]>({
    queryKey: ['/api/user/connection-suggestions'],
    enabled: !!user,
  });

  // Get user's circles (friend groups)
  const { data: circles = [], isLoading: circlesLoading } = useQuery<FriendGroup[]>({
    queryKey: ['/api/friend-groups'],
    enabled: !!user,
  });

  // Connection mutations
  const acceptRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', `/api/friends/accept`, { friend_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/connections/pending'] });
    }
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('DELETE', `/api/friends/request`, { friend_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/connections/pending'] });
    }
  });

  const connectMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', `/api/friends/request`, { friend_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/connection-suggestions'] });
    }
  });

  const removeConnectionMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('DELETE', `/api/friends`, { friend_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/connections'] });
    }
  });

  // Create new circle (friend group) mutation
  const createCircleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/friend-groups', {
        name: newCircleName,
        description: newCircleDescription
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friend-groups'] });
      setNewCircleName("");
      setNewCircleDescription("");
      setDialogOpen(false);
    }
  });

  // Filter connections by search query
  const filteredConnections = connections.filter(
    connection => connection.profile?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout showRightSidebar={false}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Connections</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search connections..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="connections" className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="connections">My Connections</TabsTrigger>
            <TabsTrigger value="pending">Pending Requests</TabsTrigger>
            <TabsTrigger value="circles">My Circles</TabsTrigger>
          </TabsList>
          
          {/* Connections Tab */}
          <TabsContent value="connections">
            {connectionsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : filteredConnections.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No connections yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery 
                    ? "No connections match your search. Try a different query."
                    : "Start connecting with others to build your network!"}
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
                {filteredConnections.map(connection => (
                  <Card key={connection.user_id} className="bg-white dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <AvatarWithEmotion user={connection} size="md" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{connection.profile?.display_name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{connection.profile?.bio || "No bio"}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="text-gray-500 hover:text-red-500" 
                          onClick={() => removeConnectionMutation.mutate(connection.user_id)}
                          disabled={removeConnectionMutation.isPending}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-4">Connection Suggestions</h2>
              {suggestionsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No suggestions available at the moment.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suggestions.map(suggestion => (
                    <Card key={suggestion.user_id} className="bg-white dark:bg-gray-800">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <AvatarWithEmotion user={suggestion} size="md" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{suggestion.profile?.display_name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {suggestion.mutualFriendCount || 0} mutual connection{suggestion.mutualFriendCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <ConnectionRequestButton 
                            targetUser={suggestion}
                            size="sm"
                            className="rounded-full text-xs"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Pending Requests Tab */}
          <TabsContent value="pending">
            {pendingLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No pending requests</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  You don't have any connection requests at the moment.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRequests.map(request => (
                  <Card key={request.user_id} className="bg-white dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <AvatarWithEmotion user={request} size="md" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{request.profile?.display_name}</h3>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>Requested to connect</span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                            onClick={() => rejectRequestMutation.mutate(request.user_id)}
                            disabled={rejectRequestMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => acceptRequestMutation.mutate(request.user_id)}
                            disabled={acceptRequestMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Circles Tab */}
          <TabsContent value="circles">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">My Circles</h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Circle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Circle</DialogTitle>
                    <DialogDescription>
                      Circles help you organize your connections and share selectively with specific groups.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Circle Name</Label>
                      <Input 
                        id="name" 
                        placeholder="E.g., Close Friends, Family, Work Buddies" 
                        value={newCircleName}
                        onChange={(e) => setNewCircleName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Textarea 
                        id="description" 
                        placeholder="What brings this circle together?"
                        value={newCircleDescription}
                        onChange={(e) => setNewCircleDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createCircleMutation.mutate()}
                      disabled={!newCircleName.trim() || createCircleMutation.isPending}
                    >
                      {createCircleMutation.isPending ? "Creating..." : "Create Circle"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            {circlesLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : circles.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No circles yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Create circles to organize your connections and share posts with specific groups.
                </p>
                <Button onClick={() => setDialogOpen(true)}>Create Your First Circle</Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {circles.map(circle => (
                  <Card key={circle.friend_group_id} className="bg-white dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center">
                          {circle.name.includes("Friend") ? (
                            <Users className="text-secondary-600 dark:text-secondary-400 h-6 w-6" />
                          ) : circle.name.includes("Family") ? (
                            <Heart className="text-accent-600 dark:text-accent-400 h-6 w-6" />
                          ) : circle.name.includes("Work") ? (
                            <BriefcaseBusiness className="text-blue-600 dark:text-blue-400 h-6 w-6" />
                          ) : (
                            <UserCircle className="text-secondary-600 dark:text-secondary-400 h-6 w-6" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{circle.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {circle.description || `${circle.memberCount || 0} members`}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">Manage</Button>
                      </div>
                    </CardContent>
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

export default ConnectionsPage;
