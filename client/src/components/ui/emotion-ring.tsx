import { FC, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Emotion } from "@/types";

interface EmotionRingProps {
  emotionIds: number[];
  className?: string;
}

export const EmotionRing: FC<EmotionRingProps> = ({ emotionIds, className }) => {
  const { data: emotions } = useQuery<Emotion[]>({
    queryKey: ["/api/emotions"],
  });

  const conicGradient = useMemo(() => {
    if (!emotions || emotionIds.length === 0) {
      return "transparent";
    }

    // Get colors for the selected emotion IDs
    const colors = emotionIds
      .map(id => emotions.find(e => e.id === id)?.color)
      .filter(Boolean) as string[];

    if (colors.length === 0) return "transparent";
    if (colors.length === 1) return colors[0];

    // Calculate segments for conic gradient
    const segmentSize = 100 / colors.length;
    let gradient = "conic-gradient(from 0deg";

    colors.forEach((color, index) => {
      const startPercentage = index * segmentSize;
      const endPercentage = (index + 1) * segmentSize;
      gradient += `, ${color} ${startPercentage}%, ${color} ${endPercentage}%`;
    });

    gradient += ")";
    return gradient;
  }, [emotions, emotionIds]);

  return (
    <div 
      className={cn("emotion-ring", className)}
      style={{ background: conicGradient }}
    />
  );
};
