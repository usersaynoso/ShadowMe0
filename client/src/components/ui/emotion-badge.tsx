import { FC } from "react";
import { cn } from "@/lib/utils";

interface EmotionBadgeProps {
  emotion: {
    id: number;
    name: string;
    color: string;
  };
  selected?: boolean;
  size?: "xs" | "sm";
  onClick?: () => void;
  className?: string;
}

export const EmotionBadge: FC<EmotionBadgeProps> = ({
  emotion,
  selected = false,
  size = "sm",
  onClick,
  className,
}) => {
  const hexColor = emotion.color;
  
  // Create background with 15% opacity of the main color
  const getBackgroundColor = () => {
    if (!selected) return "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400";

    // Convert hex to rgba with 0.15 opacity for background
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    return `bg-[rgba(${r},${g},${b},0.15)] text-[${hexColor}]`;
  };

  const sizeClasses = {
    xs: "px-2 py-0.5 text-xs rounded",
    sm: "px-3 py-1.5 text-sm rounded-full",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center",
        sizeClasses[size],
        getBackgroundColor(),
        onClick ? "cursor-pointer" : "cursor-default",
        className
      )}
    >
      <span 
        className={cn(
          "rounded-full mr-1.5",
          size === "xs" ? "w-1.5 h-1.5" : "w-2 h-2"
        )}
        style={{ backgroundColor: hexColor }}
      />
      {emotion.name}
    </button>
  );
};
