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
  thickness = 40, // Reduced by 33% from 60 to 40
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
      // For a single emotion, use a solid color with transparent edges
      const color = emotions[0].color;
      return `radial-gradient(circle, ${color} 0%, ${color} 60%, transparent 100%)`;
    } else {
      // Create a conic gradient with color blending between adjacent emotions
      const numEmotions = emotions.length;
      const fullCircle = 360; // degrees
      const segmentSize = fullCircle / numEmotions;
      
      // Using degrees instead of percentages for more precise control
      let gradientParts: string[] = [];
      
      for (let i = 0; i < numEmotions; i++) {
        const currentColor = emotions[i].color;
        const nextColor = emotions[(i + 1) % numEmotions].color;
        
        const segmentStart = i * segmentSize;
        const segmentEnd = (i + 1) * segmentSize;
        
        // The midpoint where colors should be at full strength
        const midPoint = segmentStart + (segmentSize / 2);
        
        // Blend zone size (in degrees)
        const blendZone = segmentSize / 4; // 25% of segment for blending
        
        // Add the current color at the start of the segment
        gradientParts.push(`${currentColor} ${segmentStart}deg`);
        
        // For smoother transitions, add more color stops
        if (numEmotions > 2) {
          // Midpoint of current color
          gradientParts.push(`${currentColor} ${midPoint - blendZone}deg`);
          
          // Start of blend zone to next color
          gradientParts.push(`${nextColor} ${midPoint + blendZone}deg`);
        }
        
        // Add the next color at the end of this segment
        gradientParts.push(`${nextColor} ${segmentEnd}deg`);
      }
      
      const gradientString = `conic-gradient(${gradientParts.join(', ')})`;
      return gradientString;
    }
  };
  
  // Generate gradient value
  const gradientValue = generateGradient();
  
  // Log to check emotions and gradient
  console.log('Emotions:', emotions);
  console.log('Gradient:', gradientValue);
  console.log('Using thickness:', thickness);
  
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
          // Ring mask with fading edges
          maskImage: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px), transparent 100%)`,
          WebkitMaskImage: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px), transparent 100%)`,
          // Apply additional radial gradient to fade colors to transparent at edges
          backgroundBlendMode: "normal",
          boxShadow: emotions.length > 1 ? `0 0 0 ${thickness}px rgba(0,0,0,0.05) inset` : "none",
          transform: "scale(1.2)", // Scale up the ring to make it more visible
        }}
      />
      {/* Add an overlay div for radial fade effect for multiple emotions */}
      {emotions.length > 1 && (
        <div 
          className="absolute pointer-events-none"
          style={{
            inset: `-${thickness}px`,
            borderRadius: "50%",
            background: `radial-gradient(circle, transparent 60%, rgba(0,0,0,0.25) 100%)`,
            mixBlendMode: "overlay",
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 0)`,
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 0)`,
            transform: "scale(1.2)", // Scale up the overlay to match
          }}
        />
      )}
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