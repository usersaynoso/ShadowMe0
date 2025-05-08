import { FC } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const onlineStatusVariants = cva(
  "relative flex items-center justify-center rounded-full border-2 border-background",
  {
    variants: {
      size: {
        sm: "h-2 w-2",
        md: "h-3 w-3",
        lg: "h-4 w-4",
      },
      status: {
        online: "bg-green-500",
        offline: "bg-gray-400",
        away: "bg-yellow-500",
        busy: "bg-red-500",
      },
      pulsating: {
        true: "after:absolute after:inset-0 after:rounded-full after:shadow-[0_0_0_rgba(74,222,128,0.4)] after:animate-ping",
      },
    },
    defaultVariants: {
      size: "md",
      status: "offline",
      pulsating: false,
    },
  }
);

export interface OnlineStatusProps
  extends VariantProps<typeof onlineStatusVariants> {
  className?: string;
  absolute?: boolean;
  absolutePosition?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

export const OnlineStatus: FC<OnlineStatusProps> = ({
  size,
  status,
  pulsating,
  className,
  absolute = true,
  absolutePosition = "bottom-right",
}) => {
  // Map positions to tailwind classes
  const positionClasses = {
    "top-right": "top-0 right-0",
    "top-left": "top-0 left-0",
    "bottom-right": "bottom-0 right-0",
    "bottom-left": "bottom-0 left-0",
  };

  return (
    <span
      className={cn(
        onlineStatusVariants({ size, status, pulsating }),
        absolute && "absolute", 
        absolute && positionClasses[absolutePosition],
        className
      )}
      aria-label={`Status: ${status}`}
    />
  );
}; 