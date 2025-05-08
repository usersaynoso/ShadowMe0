import { FC, useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FriendGroup, User } from "@/types";
import { Loader2, Search, Users, Plus, UserCircle, Heart, BriefcaseBusiness, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CirclesPage: FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<FriendGroup | null>(null);
  
  // New circle form state
  const [newCircleName, setNewCircleName] = useState("");
  const [newCircleDescription, setNewCircleDescription] = useState("");
  
  // Get user's circles (friend groups)
  const { data: circles = [], isLoading: circlesLoading } = useQuery<FriendGroup[]>({
    queryKey: ['/api/friend-groups'],
    enabled: !!user,
  });
  
  // Get user's connections for adding to circles
  const { data: connections = [], isLoading: connectionsLoading } = useQuery<User[]>({
    queryKey: ['/api/user/connections'],
    enabled: !!user,
  });
  
  // Get circle members if a circle is selected
  const { data: circleMembers = [], isLoading: membersLoading } = useQuery<User[]>({
    queryKey: ['/api/friend-groups', selectedCircle?.friend_group_id, 'members'],
    enabled: !!selectedCircle,
  });
  
  // Create circle mutation
  const createCircleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/friend-groups', {
        name: newCircleName,
        description: newCircleDescription
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friend-groups'] });
      resetNewCircleForm();
      setDialogOpen(false);
      toast({
        title: "Circle created",
        description: "Your new circle has been created successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create circle",
        description: error.message || "Something went wrong",
        variant: "destructive"
      });
    }
  });
  
  // Add member to circle mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ circleId, userId }: { circleId: string, userId: string }) => {
      return apiRequest('POST', `/api/friend-groups/${circleId}/members`, {
        user_id: userId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/friend-groups', selectedCircle?.friend_group_id, 'members'] 
      });
      toast({
        title: "Member added",
        description: "The connection has been added to this circle."
      });
    }
  });
  
  // Remove member from circle mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ circleId, userId }: { circleId: string, userId: string }) => {
      return apiRequest('DELETE', `/api/friend-groups/${circleId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/friend-groups', selectedCircle?.friend_group_id, 'members'] 
      });
      toast({
        title: "Member removed",
        description: "The connection has been removed from this circle."
      });
    }
  });
  
  // Delete circle mutation
  const deleteCircleMutation = useMutation({
    mutationFn: async (circleId: string) => {
      return apiRequest('DELETE', `/api/friend-groups/${circleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friend-groups'] });
      setSelectedCircle(null);
      setManageDialogOpen(false);
      toast({
        title: "Circle deleted",
        description: "The circle has been permanently deleted."
      });
    }
  });
  
  // Reset new circle form
  const resetNewCircleForm = () => {
    setNewCircleName("");
    setNewCircleDescription("");
  };
  
  // Filter circles by search query
  const filteredCircles = circles.filter(
    circle => circle.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Check if a user is already a member of the selected circle
  const isCircleMember = (userId: string) => {
    return circleMembers.some(member => member.user_id === userId);
  };
  
  // Get appropriate icon for a circle based on its name
  const getCircleIcon = (circleName: string) => {
    if (circleName.toLowerCase().includes("friend")) {
      return <Users className="text-secondary-600 dark:text-secondary-400 h-6 w-6" />;
    } else if (circleName.toLowerCase().includes("family")) {
      return <Heart className="text-accent-600 dark:text-accent-400 h-6 w-6" />;
    } else if (circleName.toLowerCase().includes("work")) {
      return <BriefcaseBusiness className="text-blue-600 dark:text-blue-400 h-6 w-6" />;
    } else {
      return <UserCircle className="text-secondary-600 dark:text-secondary-400 h-6 w-6" />;
    }
  };
  
  const openManageDialog = (circle: FriendGroup) => {
    setSelectedCircle(circle);
    setManageDialogOpen(true);
  };
  
  // Open dialog if ?openCreate=1 is in the URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('openCreate') === '1') {
        setDialogOpen(true);
        params.delete('openCreate');
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);
  
  return (
    <MainLayout>
      <div className="container py-6 max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Circles</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Organize your connections into different circles
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="mt-4 md:mt-0">
            <Plus className="mr-2 h-4 w-4" />
            Create Circle
          </Button>
        </div>
        
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search circles..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {circlesLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : filteredCircles.length === 0 ? (
          <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
            <h3 className="text-lg font-medium mb-2">No circles yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create circles to organize your connections and share posts with specific groups.
            </p>
            <Button onClick={() => setDialogOpen(true)}>Create Your First Circle</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCircles.map(circle => (
              <Card key={circle.friend_group_id} className="bg-white dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center mr-3">
                        {getCircleIcon(circle.name)}
                      </div>
                      <CardTitle className="text-lg">{circle.name}</CardTitle>
                    </div>
                  </div>
                  {circle.description && (
                    <CardDescription className="mt-2">
                      {circle.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {circle.memberCount || 0} member{circle.memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => openManageDialog(circle)}
                  >
                    Manage Circle
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Create Circle Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Circle</DialogTitle>
            <DialogDescription>
              Organize your connections into circles to easily share content with specific groups.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Circle Name</Label>
              <Input 
                id="name" 
                placeholder="Friends from work"
                value={newCircleName}
                onChange={(e) => setNewCircleName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                placeholder="People I work with..."
                value={newCircleDescription}
                onChange={(e) => setNewCircleDescription(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCircleMutation.mutate()}
              disabled={!newCircleName || createCircleMutation.isPending}
            >
              {createCircleMutation.isPending ? (
                <>Creating... <Loader2 className="ml-2 h-4 w-4 animate-spin" /></>
              ) : "Create Circle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Manage Circle Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedCircle && (
            <>
              <DialogHeader>
                <DialogTitle>Manage {selectedCircle.name}</DialogTitle>
                <DialogDescription>
                  Add or remove connections from this circle
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="members" className="w-full">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="add">Add Connections</TabsTrigger>
                </TabsList>
                
                {/* Members Tab */}
                <TabsContent value="members">
                  {membersLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                    </div>
                  ) : circleMembers.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No members in this circle yet</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {circleMembers.map(member => (
                        <div key={member.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                          <div className="flex items-center space-x-3">
                            <AvatarWithEmotion user={member} size="sm" />
                            <div>
                              <p className="font-medium">{member.profile?.display_name}</p>
                              <p className="text-sm text-gray-500">{member.email}</p>
                            </div>
                          </div>
                          {user?.user_id !== member.user_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMemberMutation.mutate({
                                circleId: selectedCircle.friend_group_id,
                                userId: member.user_id
                              })}
                              disabled={removeMemberMutation.isPending}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t flex justify-between">
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this circle? This action cannot be undone.')) {
                          deleteCircleMutation.mutate(selectedCircle.friend_group_id);
                        }
                      }}
                      disabled={deleteCircleMutation.isPending}
                    >
                      {deleteCircleMutation.isPending ? "Deleting..." : "Delete Circle"}
                    </Button>
                    <Button variant="outline" onClick={() => setManageDialogOpen(false)}>
                      Close
                    </Button>
                  </div>
                </TabsContent>
                
                {/* Add Connections Tab */}
                <TabsContent value="add">
                  {connectionsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                    </div>
                  ) : connections.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">You don't have any connections yet</p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {connections.map(connection => (
                        <div key={connection.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                          <div className="flex items-center space-x-3">
                            <AvatarWithEmotion user={connection} size="sm" />
                            <div>
                              <p className="font-medium">{connection.profile?.display_name}</p>
                              <p className="text-sm text-gray-500">{connection.email}</p>
                            </div>
                          </div>
                          <Button
                            variant={isCircleMember(connection.user_id) ? "outline" : "default"}
                            size="sm"
                            onClick={() => {
                              if (!isCircleMember(connection.user_id)) {
                                addMemberMutation.mutate({
                                  circleId: selectedCircle.friend_group_id,
                                  userId: connection.user_id
                                });
                              }
                            }}
                            disabled={addMemberMutation.isPending || isCircleMember(connection.user_id)}
                          >
                            {isCircleMember(connection.user_id) ? "Added" : "Add"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <Button variant="outline" onClick={() => setManageDialogOpen(false)}>
                      Close
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default CirclesPage; 