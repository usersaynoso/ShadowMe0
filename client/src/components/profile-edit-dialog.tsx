import { FC, useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera, X, Check, Move } from "lucide-react";

// Very small initial scale to ensure image is zoomed out
const INITIAL_SCALE = 0.1;
const CONTAINER_SIZE = 300;

interface ProfileEditDialogProps {
  children: React.ReactNode;
}

export const ProfileEditDialog: FC<ProfileEditDialogProps> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [displayName, setDisplayName] = useState(user?.profile?.display_name || "");
  const [bio, setBio] = useState(user?.profile?.bio || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Crop state
  const [showCropper, setShowCropper] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  
  // Reset preview when dialog closes
  useEffect(() => {
    if (!open) {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      if (croppedImageUrl) {
        URL.revokeObjectURL(croppedImageUrl);
      }
      setAvatarFile(null);
      setAvatarPreview(null);
      setCroppedImageUrl(null);
      setShowCropper(false);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  // Center and fit image on load
  const handleImageLoad = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    // Calculate scale to cover the container (no empty space)
    const fitScale = Math.max(CONTAINER_SIZE / imgWidth, CONTAINER_SIZE / imgHeight);
    setScale(fitScale);
    // Center the image (center of image aligns with center of container)
    setPosition({ x: CONTAINER_SIZE / 2, y: CONTAINER_SIZE / 2 });
  };
  
  // When scale changes, keep the image centered
  useEffect(() => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    setPosition({ x: CONTAINER_SIZE / 2, y: CONTAINER_SIZE / 2 });
  }, [scale, avatarPreview]);
  
  // Clean up preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      if (croppedImageUrl) {
        URL.revokeObjectURL(croppedImageUrl);
      }
    };
  }, [avatarPreview, croppedImageUrl]);
  
  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("User not authenticated");
      
      const formData = new FormData();
      formData.append('avatar', file);
      
      const res = await apiRequest("POST", `/api/users/${user.user_id}/avatar`, formData);
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
      
      // Invalidate user query to refresh data AND force a refetch
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.user_id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.refetchQueries({ queryKey: [`/api/users/${user?.user_id}`] });
      queryClient.refetchQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update avatar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { display_name: string; bio: string }) => {
      const res = await apiRequest("PUT", `/api/users/${user?.user_id}/profile`, data);
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      
      // Invalidate user query to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.user_id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      try {
        // Upload avatar if one was selected and wait for it to complete
        if (avatarFile) {
          await uploadAvatarMutation.mutateAsync(avatarFile);
        }
      } catch (error) {
        // Avatar upload error is already handled in uploadAvatarMutation
      } finally {
        // Small delay to ensure UI updates before closing dialog
        setTimeout(() => {
          setOpen(false);
        }, 500);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ display_name: displayName, bio });
  };
  
  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (JPEG, PNG, GIF).",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Avatar image must be less than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setAvatarFile(file);
      
      // Create and set preview
      const preview = URL.createObjectURL(file);
      setAvatarPreview(preview);
      
      // Show the cropping interface
      setShowCropper(true);
      
      // Reset cropped image
      if (croppedImageUrl) {
        URL.revokeObjectURL(croppedImageUrl);
        setCroppedImageUrl(null);
      }
      
      // Initialize with small scale - the useEffect will handle positioning
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };
  
  // Handle avatar selection button click
  const handleSelectAvatar = () => {
    fileInputRef.current?.click();
  };
  
  // Clear avatar selection
  const handleClearAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    if (croppedImageUrl) {
      URL.revokeObjectURL(croppedImageUrl);
    }
    setAvatarFile(null);
    setAvatarPreview(null);
    setCroppedImageUrl(null);
    setShowCropper(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  
  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };
  
  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ 
      x: e.touches[0].clientX - position.x, 
      y: e.touches[0].clientY - position.y 
    });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  
  // Handle scale change
  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScale(parseFloat(e.target.value));
  };
  
  // Complete the cropping process
  const handleCompleteCrop = () => {
    if (!imgRef.current || !containerRef.current) return;
    
    // Create a canvas to draw the cropped image
    const canvas = document.createElement('canvas');
    const size = CONTAINER_SIZE;
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Create a circular clip path
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    // Get image dimensions
    const img = imgRef.current;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    
    // Draw the image so its center (after scaling) is at the center of the canvas, with drag offset
    ctx.drawImage(
      img,
      0, 0, imgWidth, imgHeight,
      size / 2 - (imgWidth * scale) / 2 + (position.x - size / 2),
      size / 2 - (imgHeight * scale) / 2 + (position.y - size / 2),
      imgWidth * scale,
      imgHeight * scale
    );
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      // Create a new File from the blob
      const croppedFile = new File([blob], avatarFile?.name || 'cropped-avatar.png', {
        type: 'image/png',
        lastModified: Date.now(),
      });
      
      // Update the avatar file with the cropped version
      setAvatarFile(croppedFile);
      
      // Create and set cropped preview
      const croppedPreview = URL.createObjectURL(blob);
      setCroppedImageUrl(croppedPreview);
      
      // Hide the cropper
      setShowCropper(false);
    }, 'image/png', 1); // Use high quality for the image
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[625px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Avatar upload section */}
            <div className="flex flex-col items-center justify-center gap-4 mb-2">
              {showCropper && avatarPreview ? (
                <div className="flex flex-col items-center">
                  <div className="text-center mb-2 text-sm text-gray-500">
                    Drag to reposition
                  </div>
                  
                  <div className="relative">
                    <div 
                      ref={containerRef}
                      className="w-[300px] h-[300px] overflow-hidden rounded-full relative border-2 border-primary/30 bg-gray-100"
                      style={{ 
                        cursor: isDragging ? 'grabbing' : 'grab',
                        touchAction: 'none' 
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <img
                        ref={imgRef}
                        src={avatarPreview}
                        alt="Crop preview"
                        className="absolute"
                        style={{
                          left: 0,
                          top: 0,
                          transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                          transformOrigin: 'center center',
                          maxWidth: 'none',
                          userSelect: 'none',
                          WebkitUserSelect: 'none'
                        }}
                        draggable={false}
                        onLoad={handleImageLoad}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Move className="text-white opacity-50 h-10 w-10" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center w-full mt-4 max-w-[300px]">
                    <span className="text-sm mr-2">-</span>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.01"
                      value={scale}
                      onChange={handleScaleChange}
                      className="flex-grow h-2 rounded-lg appearance-none bg-gray-200 dark:bg-gray-700 cursor-pointer"
                    />
                    <span className="text-sm ml-2">+</span>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex items-center"
                      onClick={handleClearAvatar}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex items-center"
                      onClick={handleCompleteCrop}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Apply Crop
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Avatar className="h-24 w-24 border-2 border-primary/10">
                    <AvatarImage 
                      src={croppedImageUrl || avatarPreview || user?.profile?.avatar_url} 
                      alt={displayName} 
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                    />
                    <AvatarFallback className="text-xl">
                      {displayName.split(' ').map(name => name[0]).join('').toUpperCase().substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                    onClick={handleSelectAvatar}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  {(avatarPreview || croppedImageUrl) && (
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={handleClearAvatar}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
              />
              <p className="text-xs text-gray-500 text-center">
                Upload a profile picture (max 10MB).<br />
                Supported formats: JPEG, PNG, GIF
              </p>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="displayName" className="text-right">
                Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bio" className="text-right">
                Bio
              </Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="submit" 
              disabled={updateProfileMutation.isPending || uploadAvatarMutation.isPending}
            >
              {(updateProfileMutation.isPending || uploadAvatarMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 