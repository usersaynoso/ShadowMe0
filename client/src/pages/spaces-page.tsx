import { FC, useState } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Group } from "@/types";
import { Loader2, Search, Users, Plus, Globe, Lock, Tag, UserPlus } from "lucide-react";
import { Link } from "wouter";

const SpacesPage: FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // New space form state
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDescription, setNewSpaceDescription] = useState("");
  const [newSpaceCategory, setNewSpaceCategory] = useState("");
  const [newSpaceIsPublic, setNewSpaceIsPublic] = useState(true);
  
  // Get groups user is a member of
  const { data: mySpaces = [], isLoading: mySpacesLoading } = useQuery<Group[]>({
    queryKey: ['/api/groups/member'],
    enabled: !!user,
  });
  
  // Get popular/featured spaces
  const { data: popularSpaces = [], isLoading: popularSpacesLoading } = useQuery<Group[]>({
    queryKey: ['/api/groups/popular'],
    enabled: !!user,
  });
  
  // Get all available spaces (paginated)
  const { data: allSpaces = [], isLoading: allSpacesLoading } = useQuery<Group[]>({
    queryKey: ['/api/groups', { search: searchQuery, category: selectedCategory === "all" ? "" : selectedCategory }],
    enabled: !!user,
  });
  
  // Get categories
  const { data: categories = [] } = useQuery<{ id: string, name: string }[]>({
    queryKey: ['/api/groups/categories'],
    enabled: !!user,
  });
  
  console.log("Categories:", categories);
  
  // Create space mutation
  const createSpaceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/groups', {
        name: newSpaceName,
        description: newSpaceDescription,
        topic_tag: newSpaceCategory,
        is_public: newSpaceIsPublic
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      resetNewSpaceForm();
      setDialogOpen(false);
    }
  });
  
  // Join space mutation
  const joinSpaceMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return apiRequest('POST', `/api/groups/${groupId}/join`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/member'] });
    }
  });
  
  // Leave space mutation
  const leaveSpaceMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return apiRequest('DELETE', `/api/groups/${groupId}/member`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups/member'] });
    }
  });
  
  // Reset new space form
  const resetNewSpaceForm = () => {
    setNewSpaceName("");
    setNewSpaceDescription("");
    setNewSpaceCategory("");
    setNewSpaceIsPublic(true);
  };
  
  // Filter spaces by search query
  const filteredAllSpaces = allSpaces.filter(
    space => space.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Check if user is member of a space
  const isSpaceMember = (groupId: string) => {
    return mySpaces.some(space => space.group_id === groupId);
  };

  // Handlers for category selection
  const handleCategoryChange = (value: string) => {
    // If "all" is selected, pass empty string to the API
    setSelectedCategory(value);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Spaces</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Space
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Space</DialogTitle>
                <DialogDescription>
                  Create a space to connect with people who share your interests
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="space-name">Space Name</Label>
                  <Input 
                    id="space-name" 
                    placeholder="Give your space a name"
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="space-description">Description</Label>
                  <Textarea 
                    id="space-description" 
                    placeholder="What is this space about?"
                    value={newSpaceDescription}
                    onChange={(e) => setNewSpaceDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="space-category">Category</Label>
                  <Select 
                    value={newSpaceCategory} 
                    onValueChange={setNewSpaceCategory}
                  >
                    <SelectTrigger id="space-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter(category => !!category.id && category.id !== "")
                        .map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="public-space">Public Space</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Allow anyone to join your space
                    </p>
                  </div>
                  <Switch 
                    id="public-space"
                    checked={newSpaceIsPublic}
                    onCheckedChange={setNewSpaceIsPublic}
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
                  onClick={() => createSpaceMutation.mutate()}
                  disabled={!newSpaceName.trim() || createSpaceMutation.isPending}
                >
                  {createSpaceMutation.isPending ? "Creating..." : "Create Space"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search spaces..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories
                .filter(category => !!category.id && category.id !== "")
                .map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        
        <Tabs defaultValue="discover" className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="my-spaces">My Spaces</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
          </TabsList>
          
          {/* Discover Tab */}
          <TabsContent value="discover">
            {allSpacesLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : filteredAllSpaces.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No spaces found</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery || selectedCategory
                    ? "No spaces match your current filters. Try different search criteria."
                    : "There are no spaces available at the moment."}
                </p>
                {(searchQuery || selectedCategory) && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAllSpaces.map(space => (
                  <Card key={space.group_id} className="bg-white dark:bg-gray-800">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{space.name}</CardTitle>
                        <div className="flex items-center text-xs rounded px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {space.is_public ? (
                            <Globe className="h-3 w-3 mr-1" />
                          ) : (
                            <Lock className="h-3 w-3 mr-1" />
                          )}
                          <span>{space.is_public ? 'Public' : 'Private'}</span>
                        </div>
                      </div>
                      {space.topic_tag && (
                        <div className="flex items-center mt-1">
                          <Tag className="h-3 w-3 mr-1 text-gray-500" />
                          <span className="text-xs text-gray-500">{space.topic_tag}</span>
                        </div>
                      )}
                      <CardDescription className="mt-2">
                        {space.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="flex items-center">
                        <div className="flex -space-x-2 mr-2">
                          {space.previewMembers?.slice(0, 3).map(member => (
                            <AvatarWithEmotion
                              key={member.user_id} 
                              user={member}
                              size="sm"
                              className="w-6 h-6 border border-white dark:border-gray-800"
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {(space.memberCount ?? 0)} member{(space.memberCount ?? 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {isSpaceMember(space.group_id) ? (
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => leaveSpaceMutation.mutate(space.group_id)}
                          disabled={leaveSpaceMutation.isPending}
                        >
                          {leaveSpaceMutation.isPending ? "Leaving..." : "Leave Space"}
                        </Button>
                      ) : (
                        <Button 
                          className="w-full"
                          onClick={() => joinSpaceMutation.mutate(space.group_id)}
                          disabled={joinSpaceMutation.isPending}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          {joinSpaceMutation.isPending ? "Joining..." : "Join Space"}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* My Spaces Tab */}
          <TabsContent value="my-spaces">
            {mySpacesLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : mySpaces.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">You haven't joined any spaces yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Discover spaces that match your interests and join the conversation
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => setDialogOpen(true)}>Create a Space</Button>
                  <Button 
                    variant="outline" 
                    onClick={() => (document.querySelector('[data-value="discover"]') as HTMLElement)?.click()}
                  >
                    Discover Spaces
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mySpaces.map(space => (
                  <Card key={space.group_id} className="bg-white dark:bg-gray-800">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{space.name}</CardTitle>
                        <div className="flex items-center text-xs rounded px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {space.is_public ? (
                            <Globe className="h-3 w-3 mr-1" />
                          ) : (
                            <Lock className="h-3 w-3 mr-1" />
                          )}
                          <span>{space.is_public ? 'Public' : 'Private'}</span>
                        </div>
                      </div>
                      {space.topic_tag && (
                        <div className="flex items-center mt-1">
                          <Tag className="h-3 w-3 mr-1 text-gray-500" />
                          <span className="text-xs text-gray-500">{space.topic_tag}</span>
                        </div>
                      )}
                      <CardDescription className="mt-2">
                        {space.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="flex items-center">
                        <div className="flex -space-x-2 mr-2">
                          {space.previewMembers?.slice(0, 3).map(member => (
                            <AvatarWithEmotion
                              key={member.user_id} 
                              user={member}
                              size="sm"
                              className="w-6 h-6 border border-white dark:border-gray-800"
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {(space.memberCount ?? 0)} member{(space.memberCount ?? 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Link href={`/spaces/${space.group_id}`}>
                        <Button className="flex-1">View Space</Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => leaveSpaceMutation.mutate(space.group_id)}
                        disabled={leaveSpaceMutation.isPending}
                      >
                        {leaveSpaceMutation.isPending ? "Leaving..." : "Leave Space"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Popular Tab */}
          <TabsContent value="popular">
            {popularSpacesLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : popularSpaces.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No popular spaces available</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Check back later for trending spaces
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {popularSpaces.map(space => (
                  <Card key={space.group_id} className="bg-white dark:bg-gray-800">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{space.name}</CardTitle>
                        <div className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                          {(space.memberCount ?? 0)} members
                        </div>
                      </div>
                      {space.topic_tag && (
                        <div className="flex items-center mt-1">
                          <Tag className="h-3 w-3 mr-1 text-gray-500" />
                          <span className="text-xs text-gray-500">{space.topic_tag}</span>
                        </div>
                      )}
                      <CardDescription className="mt-2">
                        {space.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="flex items-center">
                        <div className="flex -space-x-2 mr-2">
                          {space.previewMembers?.slice(0, 3).map(member => (
                            <AvatarWithEmotion
                              key={member.user_id} 
                              user={member}
                              size="sm"
                              className="w-6 h-6 border border-white dark:border-gray-800"
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {space.memberCount != null && space.previewMembers && space.previewMembers.length < space.memberCount
                            ? `+${space.memberCount - space.previewMembers.length} more`
                            : ''}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Link href={`/spaces/${space.group_id}`}>
                        <Button className="w-full">View Space</Button>
                      </Link>
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

export default SpacesPage;
