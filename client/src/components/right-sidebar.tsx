import { FC } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { User, Group } from "@/types";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircle } from "lucide-react";

export const RightSidebar: FC = () => {
  // Get connection suggestions
  const { data: suggestions = [] } = useQuery<User[]>({
    queryKey: ['/api/user/connection-suggestions'],
  });
  
  // Get popular spaces
  const { data: popularSpaces = [] } = useQuery<Group[]>({
    queryKey: ['/api/groups/popular'],
  });
  
  // Get online connections
  const { data: onlineConnections = [] } = useQuery<User[]>({
    queryKey: ['/api/user/connections/online'],
  });
  
  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', `/api/friends/request`, { friend_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/connection-suggestions'] });
    }
  });

  return (
    <div className="sticky top-20">
      {/* Connection Suggestions */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Connection Suggestions</h3>
          <Link href="/connections">
            <Button variant="link" size="sm" className="text-primary-600 dark:text-primary-400 p-0 h-auto">
              See All
            </Button>
          </Link>
        </div>
        
        <div className="space-y-4">
          {suggestions.slice(0, 3).map(user => (
            <div key={user.user_id} className="flex items-center space-x-3">
              <AvatarWithEmotion user={user} />
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate">{user.profile?.display_name}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.mutualFriendCount || 0} mutual connection{user.mutualFriendCount !== 1 ? 's' : ''}
                </p>
              </div>
              
              <Button
                size="sm" 
                className="px-3 py-1.5 rounded-full text-xs"
                onClick={() => connectMutation.mutate(user.user_id)}
                disabled={connectMutation.isPending}
              >
                Connect
              </Button>
            </div>
          ))}
        </div>
      </Card>
      
      {/* Popular Spaces */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Popular Spaces</h3>
          <Link href="/spaces">
            <Button variant="link" size="sm" className="text-primary-600 dark:text-primary-400 p-0 h-auto">
              Browse All
            </Button>
          </Link>
        </div>
        
        <div className="space-y-4">
          {popularSpaces.slice(0, 2).map(space => (
            <div 
              key={space.group_id}
              className="group p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {space.name}
                </h4>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                  {space.memberCount || 0} members
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{space.description}</p>
              <div className="flex -space-x-2">
                {space.previewMembers?.slice(0, 3).map(member => (
                  <AvatarWithEmotion
                    key={member.user_id} 
                    user={member}
                    size="sm"
                    className="w-6 h-6 border border-white dark:border-gray-800"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      
      {/* Online Connections */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Online Now</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {onlineConnections.length} connection{onlineConnections.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-hide">
          {onlineConnections.slice(0, 3).map(connection => (
            <div key={connection.user_id} className="flex items-center space-x-3">
              <AvatarWithEmotion 
                user={connection}
                showStatus={true}
              />
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate">{connection.profile?.display_name}</h4>
                <p className="text-xs text-green-500 truncate">Active now</p>
              </div>
              
              <Button 
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-1"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
