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
  
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const ring = ringRef.current;
    
    if (!wrapper || !ring || emotions.length === 0) return;
    
    // Build the conic gradient with sharp color transitions
    if (emotions.length === 1) {
      // For a single emotion, use a solid color
      ring.style.setProperty('--gradient', emotions[0].color);
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
      ring.style.setProperty('--gradient', gradientString);
    }
  }, [emotions]);
  
  if (emotions.length === 0) return <>{children}</>;
  
  // Create the ring content as a separate component
  const RingContent = (
    <>
      {children}
      <div 
        ref={ringRef} 
        className="ring absolute pointer-events-none"
        style={{
          inset: `calc(-1 * ${thickness}px)`,
          borderRadius: "50%",
          background: "var(--gradient)",
          // Simple ring mask with sharp edges
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 0)`,
          // No blur or glow effects for a clean look
          animation: rotation ? `spin ${rotation}s linear infinite` : 'none'
        }}
      />
    </>
  );
  
  // Common styles for both Link and div
  const commonStyles = {
    '--ring-thickness': `${thickness}px`,
    '--ring-rotation': `${rotation}s`,
  } as React.CSSProperties;
  
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
          style={commonStyles}
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
      style={commonStyles}
    >
      {RingContent}
    </div>
  );
}; 