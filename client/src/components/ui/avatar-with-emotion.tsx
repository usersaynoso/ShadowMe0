import React, { FC } from 'react';
import { User } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OnlineStatus } from "@/components/ui/online-status";
import { cn } from "@/lib/utils";

interface AvatarWithEmotionProps {
  user: User;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  emotionOverrides?: number[]; // specific emotions to show instead of user's lastEmotions
  showOnlineStatus?: boolean;
}

export const AvatarWithEmotion: FC<AvatarWithEmotionProps> = ({ 
  user, 
  className = "",
  size = "md",
  emotionOverrides,
  showOnlineStatus = true
}) => {
  // Determine which emotions to use (override or user's last emotions)
  const emotionIds = emotionOverrides || user.lastEmotions || [];
  
  // Calculate dimensions based on size
  const dimensions = {
    sm: {
      outer: 'h-8 w-8',
      inner: 'h-7 w-7',
      border: 'border-[2px]',
      gradient: '1.5px',
      initials: 'text-xs'
    },
    md: {
      outer: 'h-10 w-10',
      inner: 'h-9 w-9',
      border: 'border-[3px]',
      gradient: '2px',
      initials: 'text-sm'
    },
    lg: {
      outer: 'h-16 w-16',
      inner: 'h-14 w-14',
      border: 'border-[4px]',
      gradient: '3px',
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

  // Define emotion colors with fallbacks
  const emotionColors = [
    '#FFC107', // Default yellow if no emotion
    '#4CAF50', // Green
    '#2196F3', // Blue
  ];

  // Get colors for the emotions
  const getEmotionColors = () => {
    if (emotionIds.length === 0) {
      return [emotionColors[0]]; // Return default color if no emotions
    }
    
    // Return actual colors from the emotionIds (would typically come from API)
    return emotionIds.slice(0, 3).map((id, index) => {
      // This is a simplification - in production you would look up the real colors
      return emotionColors[index % emotionColors.length];
    });
  };

  const colors = getEmotionColors();
  
  // Create CSS gradient based on emotions
  const createGradient = () => {
    if (colors.length === 1) {
      return `${colors[0]}`;
    }
    
    if (colors.length === 2) {
      return `linear-gradient(to right, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1]} 50%, ${colors[1]} 100%)`;
    }
    
    return `conic-gradient(
      ${colors[0]} 0deg, 
      ${colors[0]} 120deg, 
      ${colors[1]} 120deg, 
      ${colors[1]} 240deg, 
      ${colors[2]} 240deg, 
      ${colors[2]} 360deg
    )`;
  };

  // Map component size to OnlineStatus size
  const onlineStatusSize = {
    sm: 'sm',
    md: 'md',
    lg: 'lg'
  } as const;

  return (
    <div 
      className={cn(
        "relative rounded-full flex items-center justify-center",
        dimensions[size].outer,
        className
      )}
      style={{
        background: createGradient(),
        padding: dimensions[size].gradient
      }}
    >
      <Avatar className={cn(
        "border bg-white dark:bg-gray-800", 
        dimensions[size].inner,
        dimensions[size].border
      )}>
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
    </div>
  );
};