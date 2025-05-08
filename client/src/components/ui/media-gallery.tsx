import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Media } from '@/types';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface MediaGalleryProps {
  media: Media[];
  className?: string;
}

export function MediaGallery({ media, className }: MediaGalleryProps) {
  const [activeMedia, setActiveMedia] = useState<Media | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  if (!media || media.length === 0) {
    return null;
  }
  
  const activeIndex = activeMedia 
    ? media.findIndex(m => m.media_id === activeMedia.media_id) 
    : -1;
  
  const handleNext = () => {
    const nextIndex = (activeIndex + 1) % media.length;
    setActiveMedia(media[nextIndex]);
  };
  
  const handlePrevious = () => {
    const prevIndex = activeIndex > 0 ? activeIndex - 1 : media.length - 1;
    setActiveMedia(media[prevIndex]);
  };
  
  const getMedia = (mediaItem: Media) => {
    if (mediaItem.media_type.startsWith('image/')) {
      return (
        <img 
          src={mediaItem.media_url} 
          alt="Media" 
          className="max-h-[80vh] max-w-full object-contain rounded-md"
        />
      );
    } else if (mediaItem.media_type.startsWith('video/')) {
      return (
        <video 
          src={mediaItem.media_url} 
          controls 
          className="max-h-[80vh] max-w-full object-contain rounded-md"
        />
      );
    } else {
      return (
        <div className="p-8 flex items-center justify-center text-center rounded-md border">
          <p>Unsupported media type: {mediaItem.media_type}</p>
        </div>
      );
    }
  };
  
  return (
    <div className={cn("", className)}>
      {media.length === 1 ? (
        <div 
          className="rounded-md overflow-hidden cursor-pointer"
          onClick={() => {
            setActiveMedia(media[0]);
            setLightboxOpen(true);
          }}
        >
          <img 
            src={media[0].media_url} 
            alt="Media" 
            className="w-full h-auto max-h-[300px] object-cover rounded-md" 
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {media.map((item, index) => (
            <div 
              key={item.media_id} 
              className="rounded-md overflow-hidden cursor-pointer"
              onClick={() => {
                setActiveMedia(item);
                setLightboxOpen(true);
              }}
            >
              <img 
                src={item.media_url} 
                alt={`Media ${index + 1}`} 
                className="w-full h-[150px] object-cover" 
              />
            </div>
          ))}
        </div>
      )}
      
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent">
          <div className="relative flex items-center justify-center">
            {activeMedia && getMedia(activeMedia)}
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 text-foreground"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {media.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 text-foreground"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 text-foreground"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 