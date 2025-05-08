import { FC, useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Emotion } from "@/types";
import { Link } from "wouter";

interface AvatarRingProps {
  emotions: Emotion[];
  children: ReactNode;
  className?: string;
  thickness?: number;
  rotation?: number;
  href?: string; // Add profile link URL
}

export const AvatarRing: FC<AvatarRingProps> = ({ 
  emotions, 
  children,
  className,
  thickness = 14,
  rotation = 0, // Default to no rotation
  href
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  
  // Generate gradient immediately to ensure it's visible
  const generateGradient = () => {
    if (emotions.length === 0) {
      return 'transparent';
    }
    
    if (emotions.length === 1) {
      // For a single emotion, use a solid color
      return emotions[0].color;
    } else {
      // For multiple emotions, create a clean segmented ring
      let gradientString = 'conic-gradient(';
      
      const step = 100 / emotions.length;
      emotions.forEach((emotion, index) => {
        const startPercent = index * step;
        const endPercent = (index + 1) * step;
        
        // Add sharp color transitions
        gradientString += `${emotion.color} ${startPercent}%, ${emotion.color} ${endPercent}%`;
        
        // Add comma if not the last element
        if (index < emotions.length - 1) {
          gradientString += ', ';
        }
      });
      
      gradientString += ')';
      return gradientString;
    }
  };
  
  // Generate gradient value
  const gradientValue = generateGradient();
  
  // Log to check emotions and gradient
  console.log('Emotions:', emotions);
  console.log('Gradient:', gradientValue);
  
  if (emotions.length === 0) return <>{children}</>;
  
  // Create the ring content as a separate component
  const RingContent = (
    <>
      {children}
      <div 
        ref={ringRef} 
        className="ring absolute pointer-events-none"
        style={{
          inset: `-${thickness}px`,
          borderRadius: "50%",
          background: gradientValue,
          // Simple ring mask with sharp edges
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 0)`,
          // No animation for now
        }}
      />
    </>
  );
  
  // If we have an href, render a Link
  if (href) {
    return (
      <Link href={href}>
        <a 
          className={cn(
            "avatar-ring",
            "inline-block relative cursor-pointer",
            className
          )}
        >
          {RingContent}
        </a>
      </Link>
    );
  }
  
  // Otherwise, render a normal div
  return (
    <div 
      ref={wrapperRef}
      className={cn(
        "avatar-ring",
        "inline-block relative",
        className
      )}
    >
      {RingContent}
    </div>
  );
}; 