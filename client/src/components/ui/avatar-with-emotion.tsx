import React, { FC } from 'react';
import { User } from "@/types";
import { AvatarWithRing } from '@/components/ui/avatar-with-ring';
import { cn } from "@/lib/utils";

/**
 * @deprecated This component is being maintained for backward compatibility.
 * Please use AvatarWithRing for new implementations which offers more features.
 */
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
  // Simply pass through to AvatarWithRing which has the same functionality
  return (
    <AvatarWithRing
      user={user}
      emotionIds={emotionOverrides}
      className={className}
      size={size}
      showOnlineStatus={showOnlineStatus}
    />
  );
};