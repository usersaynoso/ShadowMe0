import React, { FC } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export interface Emotion {
  id: number;
  name: string;
  color: string;
}

interface EmotionSelectorProps {
  emotions: Emotion[];
  selectedEmotions: number[];
  onChange: (ids: number[]) => void;
  max?: number; // Maximum number of selections allowed
  isFilter?: boolean; // Is this used as a filter (true) or selection (false)
  disabled?: boolean;
}

export const EmotionSelector: FC<EmotionSelectorProps> = ({
  emotions,
  selectedEmotions,
  onChange,
  max = 3,
  isFilter = false,
  disabled = false
}) => {
  const handleToggleEmotion = (emotionId: number) => {
    if (disabled) return;
    
    if (selectedEmotions.includes(emotionId)) {
      // Remove emotion if already selected
      onChange(selectedEmotions.filter(id => id !== emotionId));
    } else {
      // Add emotion if not at max limit
      if (selectedEmotions.length < max || isFilter) {
        onChange([...selectedEmotions, emotionId]);
      } else if (max === 1) {
        // If max is 1, replace the selection
        onChange([emotionId]);
      } else {
        // Replace the first emotion if at max limit
        onChange([...selectedEmotions.slice(1), emotionId]);
      }
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        {emotions.map((emotion) => {
          const isSelected = selectedEmotions.includes(emotion.id);
          return (
            <Button
              key={emotion.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "rounded-full shadow-sm transition-all",
                {
                  "ring-2": isSelected,
                  "opacity-60": !isSelected && selectedEmotions.length >= max && !isFilter && !disabled,
                  "cursor-not-allowed opacity-50": disabled
                }
              )}
              style={{
                backgroundColor: isSelected ? emotion.color : 'transparent',
                borderColor: emotion.color,
                color: isSelected ? getContrastColor(emotion.color) : undefined,
                // Add ring color that's slightly transparent
                boxShadow: isSelected ? `0 0 0 2px ${emotion.color}33` : undefined
              }}
              onClick={() => handleToggleEmotion(emotion.id)}
              disabled={disabled}
            >
              {emotion.name}
            </Button>
          );
        })}
        
        {isFilter && selectedEmotions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={clearAll}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
      
      {!isFilter && selectedEmotions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {selectedEmotions.length === 1 
              ? "1 emotion selected" 
              : `${selectedEmotions.length}/${max} emotions selected`}
          </Badge>
        </div>
      )}
    </div>
  );
};

// Helper function to determine text color based on background color
function getContrastColor(hexColor: string): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.substring(1, 3), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);
  
  // Calculate luminance using a common formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}