import { FC } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { Button } from "@/components/ui/button";
import { User, FriendGroup, ShadowSession } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  BriefcaseBusiness, 
  Heart, 
  Plus,
  CalendarDays,
  UserCircle
} from "lucide-react";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";

export const LeftSidebar: FC = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Get user's circles (friend groups)
  const { data: friendGroups = [] } = useQuery<FriendGroup[]>({
    queryKey: ['/api/friend-groups'],
    enabled: !!user,
  });
  
  // Get upcoming shadow sessions
  const { data: upcomingSessions = [] } = useQuery<ShadowSession[]>({
    queryKey: ['/api/shadow-sessions/upcoming'],
    enabled: !!user,
  });

  return (
    <div className="sticky top-20">
      {/* User Profile */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <AvatarWithEmotion 
              user={user!}
              size="lg"
            />
          </div>
          
          <h2 className="text-lg font-semibold">{user?.profile?.display_name}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{user?.profile?.bio}</p>
          
          <div className="flex space-x-2 mb-4">
            <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 rounded-full text-xs">
              Level {user?.user_level || 1}
            </span>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
              {user?.user_points || 0} points
            </span>
          </div>
          
          <div className="w-full grid grid-cols-3 gap-2 text-center text-sm">
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-semibold">--</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Posts</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-semibold">--</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Connections</p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-semibold">{friendGroups.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Circles</p>
            </div>
          </div>
        </div>
      </Card>
      
      {/* My Circles */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">My Circles</h3>
          <Link href="/connections">
            <Button variant="link" size="sm" className="text-primary-600 dark:text-primary-400 p-0 h-auto">
              See All
            </Button>
          </Link>
        </div>
        
        <div className="space-y-3">
          {friendGroups.slice(0, 3).map(group => (
            <div 
              key={group.friend_group_id}
              className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
            >
              <div className="flex-shrink-0 w-9 h-9 bg-secondary-100 dark:bg-secondary-900/30 rounded-full flex items-center justify-center">
                {group.name.includes("Friend") ? (
                  <Users className="text-secondary-600 dark:text-secondary-400 h-4 w-4" />
                ) : group.name.includes("Family") ? (
                  <Heart className="text-accent-600 dark:text-accent-400 h-4 w-4" />
                ) : group.name.includes("Work") ? (
                  <BriefcaseBusiness className="text-blue-600 dark:text-blue-400 h-4 w-4" />
                ) : (
                  <UserCircle className="text-secondary-600 dark:text-secondary-400 h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{group.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{group.memberCount || 0} members</p>
              </div>
            </div>
          ))}
          
          <Button 
            variant="outline" 
            className="flex items-center justify-center w-full p-2 text-sm text-primary-600 dark:text-primary-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            onClick={() => navigate('/circles?openCreate=1')}
          >
            <Plus className="mr-2 h-4 w-4" /> Create New Circle
          </Button>
        </div>
      </Card>
      
      {/* Upcoming Shadow Sessions */}
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Upcoming Shadow Sessions</h3>
          <Link href="/shadow-sessions">
            <Button variant="link" size="sm" className="text-primary-600 dark:text-primary-400 p-0 h-auto">
              See All
            </Button>
          </Link>
        </div>
        
        <div className="space-y-4">
          {upcomingSessions.slice(0, 2).map(session => (
            <div 
              key={session.post_id}
              className="p-3 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-sm">{session.title}</h4>
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-800/30 text-purple-800 dark:text-purple-300 rounded text-xs">
                  {format(new Date(session.starts_at), "EEE")}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                {format(new Date(session.starts_at), "h:mm a")} - {format(new Date(session.ends_at), "h:mm a")}
              </p>
              <div className="flex items-center mt-2">
                <div className="flex -space-x-2">
                  {session.participants?.slice(0, 2).map(participant => (
                    <AvatarWithEmotion
                      key={participant.user_id}
                      user={participant}
                      size="sm"
                      className="w-6 h-6 border border-white dark:border-gray-800"
                    />
                  ))}
                  
                  {session.participants && session.participants.length > 2 && (
                    <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/30 border border-white dark:border-gray-800 flex items-center justify-center">
                      <span className="text-xs text-purple-800 dark:text-purple-300">+{session.participants.length - 2}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  {session.participants?.length || 0} participants
                </span>
              </div>
            </div>
          ))}
          
          <Button 
            variant="outline" 
            className="flex items-center justify-center w-full p-2 text-sm text-primary-600 dark:text-primary-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            onClick={() => navigate('/shadow-sessions?openCreate=1')}
          >
            <Plus className="mr-2 h-4 w-4" /> Create New Session
          </Button>
        </div>
      </Card>
    </div>
  );
};
