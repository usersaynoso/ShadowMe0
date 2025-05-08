import { FC } from 'react';
import { User } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OnlineStatus } from "@/components/ui/online-status";
import { cn } from "@/lib/utils";
import { AvatarRing } from "@/components/ui/avatar-ring";
import { useQuery } from "@tanstack/react-query";
import { Emotion } from "@/types";

interface AvatarWithRingProps {
  user: User;
  emotionIds?: number[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showOnlineStatus?: boolean;
}

export const AvatarWithRing: FC<AvatarWithRingProps> = ({ 
  user, 
  emotionIds,
  className = "",
  size = "md",
  showOnlineStatus = true
}) => {
  // Use the emotion ids from props or the user's lastEmotions
  const selectedEmotionIds = emotionIds || user.lastEmotions || [];
  
  // Load emotions from API
  const { data: allEmotions = [], isLoading: emotionsLoading } = useQuery<Emotion[]>({
    queryKey: ['/api/emotions'],
  });
  
  // Map emotion IDs to actual emotion objects
  // Ensure they're in the same order as the selectedEmotionIds to maintain color consistency
  const emotions = selectedEmotionIds
    .map(id => {
      const emotion = allEmotions.find(e => e.id === id);
      if (emotion) return emotion;
      return null;
    })
    .filter(Boolean) as Emotion[];
  
  // Calculate dimensions based on size
  const dimensions = {
    sm: {
      avatar: 'h-8 w-8',
      initials: 'text-xs'
    },
    md: {
      avatar: 'h-10 w-10',
      initials: 'text-sm'
    },
    lg: {
      avatar: 'h-16 w-16',
      initials: 'text-lg'
    }
  };

  // Helper to get user initials
  const getInitials = () => {
    if (!user.profile?.display_name) return '?';
    return user.profile.display_name
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Map component size to OnlineStatus size
  const onlineStatusSize = {
    sm: 'sm',
    md: 'md',
    lg: 'lg'
  } as const;

  return (
    <AvatarRing 
      emotions={emotions}
      className={cn("relative", className)}
      // Adjust thickness, blur, rotation and outer glow based on size
      thickness={size === 'sm' ? 6 : size === 'md' ? 10 : 14}
      blur={size === 'sm' ? 20 : size === 'md' ? 30 : 40}
      outerGlow={size === 'sm' ? 12 : size === 'md' ? 20 : 30}
      rotation={120}
    >
      <Avatar className={cn("border bg-white dark:bg-gray-800", dimensions[size].avatar)}>
        <AvatarImage 
          src={user.profile?.avatar_url} 
          alt={user.profile?.display_name || "User"} 
        />
        <AvatarFallback className={dimensions[size].initials}>
          {getInitials()}
        </AvatarFallback>
      </Avatar>
      
      {/* Online indicator */}
      {showOnlineStatus && user.isOnline && (
        <OnlineStatus 
          status="online" 
          size={onlineStatusSize[size]}
          pulsating={true}
          absolutePosition="bottom-right"
        />
      )}
    </AvatarRing>
  );
}; 