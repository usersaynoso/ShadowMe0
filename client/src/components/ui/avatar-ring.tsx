import { FC, useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Emotion } from "@/types";

interface AvatarRingProps {
  emotions: Emotion[];
  children: ReactNode;
  className?: string;
  thickness?: number;
  blur?: number;
  rotation?: number;
  outerGlow?: number;
}

export const AvatarRing: FC<AvatarRingProps> = ({ 
  emotions, 
  children,
  className,
  thickness = 10,
  blur = 30,
  rotation = 120,
  outerGlow = 20
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const ring = ringRef.current;
    const tooltip = tooltipRef.current;
    
    if (!wrapper || !ring || !tooltip || emotions.length === 0) return;
    
    // Build the conic gradient
    const step = 100 / emotions.length;
    let acc = 0;
    const segments = emotions.map(e => {
      const start = acc.toFixed(4);
      acc += step;
      const end = acc.toFixed(4);
      return `${e.color} ${start}% ${end}%`;
    }).join(', ');
    
    // Set the gradient with 0deg starting position to ensure proper circular display
    ring.style.setProperty('--gradient', `conic-gradient(from 0deg, ${segments})`);
    
    // Handle pointer interactions
    const handlePointerMove = (e: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const angle = (Math.atan2(dy, dx) * 180/Math.PI + 360 + 90) % 360; // 0° at top
      const index = Math.floor(angle / (360/emotions.length));
      const emo = emotions[index];
      
      tooltip.textContent = emo.name;
      tooltip.style.setProperty('--tip-hue', emo.color);
      positionTooltip(tooltip, e.clientX, e.clientY - 12);
      tooltip.removeAttribute('aria-hidden');
    };
    
    const handlePointerLeave = () => {
      tooltip.setAttribute('aria-hidden', 'true');
    };
    
    wrapper.addEventListener('pointermove', handlePointerMove);
    wrapper.addEventListener('pointerleave', handlePointerLeave);
    
    return () => {
      wrapper.removeEventListener('pointermove', handlePointerMove);
      wrapper.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [emotions]);
  
  // Function to position tooltip
  const positionTooltip = (el: HTMLElement, x: number, y: number) => {
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  };
  
  if (emotions.length === 0) return <>{children}</>;
  
  return (
    <div 
      ref={wrapperRef}
      className={cn(
        "avatar-ring",
        "inline-block relative",
        className
      )}
      style={{
        '--ring-thickness': `${thickness}px`,
        '--ring-blur': `${blur}px`,
        '--ring-rotation': `${rotation}s`,
        '--ring-outer-glow': `${outerGlow}px`,
      } as React.CSSProperties}
    >
      {children}
      <div 
        ref={ringRef} 
        className="ring absolute pointer-events-none"
        style={{
          inset: `calc(-1 * var(--ring-thickness) - var(--ring-outer-glow))`,
          borderRadius: "50%",
          background: "var(--gradient)",
          mask: `
            radial-gradient(
              farthest-side, 
              transparent calc(100% - var(--ring-thickness) - var(--ring-outer-glow) * 2), 
              #000 calc(100% - var(--ring-thickness) - var(--ring-outer-glow)),
              #000 calc(100% - var(--ring-outer-glow)),
              transparent 100%
            )
          `,
          filter: "blur(var(--ring-blur)) brightness(1.2) saturate(1.4)",
          animation: "spin var(--ring-rotation) linear infinite"
        }}
      />
      <div 
        ref={tooltipRef}
        role="tooltip" 
        aria-hidden="true"
        className="tooltip fixed px-3 py-1.5 font-semibold text-sm text-white bg-[#141414] rounded-lg shadow-md transform -translate-x-1/2 -translate-y-full whitespace-nowrap pointer-events-none opacity-0 transition-all duration-150 ease-in-out"
        style={{
          zIndex: 1000,
        }}
      />
    </div>
  );
}; 