import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { X, Loader2, Image, ExternalLink } from "lucide-react";
import { User } from "@/types";
import { format, parseISO } from "date-fns";

interface SessionMedia {
  id: string;
  mediaUrl: string;
  mediaType: string;
  userId: string;
  createdAt: string;
}

interface ShadowSessionMediaGalleryProps {
  sessionId: string;
}

export function ShadowSessionMediaGallery({ sessionId }: ShadowSessionMediaGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<SessionMedia | null>(null);
  
  // Get session media
  const {
    data: sessionMedia = [],
    isLoading,
    error
  } = useQuery<SessionMedia[]>({
    queryKey: ['/api/shadow-sessions', sessionId, 'media'],
    enabled: !!sessionId,
  });
  
  // Get users for attribution
  const { data: participants = [] } = useQuery<User[]>({
    queryKey: ['/api/shadow-sessions', sessionId, 'participants'],
    enabled: !!sessionId,
  });
  
  // Get user by ID
  const getUserById = (userId: string): User | undefined => {
    return participants.find(p => p.user_id === userId);
  };
  
  // Create a fallback user
  const createFallbackUser = (userId: string): User => ({
    user_id: userId,
    email: `${userId}@example.com`,
    user_type: "user",
    user_points: 0,
    user_level: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    profile: {
      display_name: "Unknown User"
    }
  });
  
  // Format date
  const formatDate = (dateString: string): string => {
    return format(parseISO(dateString), "MMM d, h:mm a");
  };
  
  // Open media modal
  const openMedia = (media: SessionMedia) => {
    setSelectedMedia(media);
  };
  
  // Close media modal
  const closeMedia = () => {
    setSelectedMedia(null);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg">
        <p>Failed to load session media.</p>
      </div>
    );
  }
  
  if (sessionMedia.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Image className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No media shared yet</h3>
        <p className="text-gray-500 mb-4">
          No one has shared any media in this session yet.
        </p>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Shared Media</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sessionMedia.map((media) => (
          <div 
            key={media.id}
            className="relative rounded-lg overflow-hidden border cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => openMedia(media)}
          >
            <img 
              src={media.mediaUrl} 
              alt="Shared media" 
              className="aspect-square object-cover w-full h-full"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-white text-xs truncate">
              <div className="flex items-center">
                <AvatarWithEmotion 
                  user={getUserById(media.userId) || createFallbackUser(media.userId)}
                  size="sm"
                  className="w-5 h-5 mr-1"
                />
                <span className="truncate">
                  {getUserById(media.userId)?.profile?.display_name || "Unknown User"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Media Viewer Dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && closeMedia()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shared Media</DialogTitle>
          </DialogHeader>
          
          {selectedMedia && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden">
                <img 
                  src={selectedMedia.mediaUrl} 
                  alt="Shared media" 
                  className="w-full object-contain max-h-[60vh]"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AvatarWithEmotion 
                    user={getUserById(selectedMedia.userId) || createFallbackUser(selectedMedia.userId)}
                    size="sm"
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium text-sm">
                      {getUserById(selectedMedia.userId)?.profile?.display_name || "Unknown User"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(selectedMedia.createdAt)}
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => window.open(selectedMedia.mediaUrl, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open Original
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 