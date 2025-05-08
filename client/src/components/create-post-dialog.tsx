import { FC, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { AvatarWithRing } from "@/components/ui/avatar-with-ring";
import { Textarea } from "@/components/ui/textarea";
import { EmotionSelector } from "@/components/ui/emotion-selector";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, Globe, Image, PenSquare, Users, Lock, CalendarIcon, Clock, SmilePlus, Tag, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Emotion, FriendGroup } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface CreatePostDialogProps {
  children?: React.ReactNode;
}

export const CreatePostDialog: FC<CreatePostDialogProps> = ({ children }) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [selectedEmotions, setSelectedEmotions] = useState<number[]>([]);
  const [audience, setAudience] = useState<string>("everyone");
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [media, setMedia] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Shadow session fields
  const [isShadowSession, setIsShadowSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  
  // Load emotions from API
  const { data: emotions = [] } = useQuery<Emotion[]>({
    queryKey: ['/api/emotions'],
  });
  
  // Load friend groups (circles) from API
  const { data: friendGroups = [] } = useQuery<FriendGroup[]>({
    queryKey: ['/api/friend-groups'],
    enabled: !!user,
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('POST', '/api/posts', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      resetForm();
    }
  });

  // Handle form submission
  const handleSubmit = () => {
    // Emotions are now optional, so we don't need to check for them
    
    const formData = new FormData();
    formData.append('content', content);
    formData.append('emotion_ids', JSON.stringify(selectedEmotions));
    formData.append('audience', audience);
    
    if (audience === 'friend_group' && selectedCircles.length > 0) {
      formData.append('friend_group_ids', JSON.stringify(selectedCircles));
    }
    
    if (media) {
      formData.append('media', media);
    }
    
    // Add shadow session data if enabled
    if (isShadowSession && sessionDate && startTime && endTime) {
      formData.append('is_shadow_session', 'true');
      formData.append('session_title', sessionTitle);
      
      const startDate = new Date(sessionDate);
      const [startHour, startMinute] = startTime.split(':').map(Number);
      startDate.setHours(startHour, startMinute);
      
      const endDate = new Date(sessionDate);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      endDate.setHours(endHour, endMinute);
      
      formData.append('starts_at', startDate.toISOString());
      formData.append('ends_at', endDate.toISOString());
      formData.append('timezone', timezone);
    }
    
    createPostMutation.mutate(formData);
  };

  // Reset form after submission
  const resetForm = () => {
    setContent("");
    setSelectedEmotions([]);
    setAudience("everyone");
    setSelectedCircles([]);
    setMedia(null);
    setPreviewUrl(null);
    setIsShadowSession(false);
    setSessionTitle("");
    setSessionDate(undefined);
    setStartTime("");
    setEndTime("");
    setTimezone("UTC");
  };
  
  // Handle media upload
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        // Add toast notification here if you have a toast component
        console.error('Only image files are supported');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        // Add toast notification here if you have a toast component
        console.error('File size exceeds 5MB limit');
        return;
      }
      
      setMedia(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };
  
  // Remove media
  const handleRemoveMedia = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setMedia(null);
    setPreviewUrl(null);
  };
  
  // Clean up preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);
  
  // Get audience label for display
  const getAudienceLabel = () => {
    switch (audience) {
      case 'everyone': return 'Everyone';
      case 'friends': return 'Connections';
      case 'just_me': return 'Just Me';
      case 'friend_group': return selectedCircles.length > 0 
        ? `${selectedCircles.length} Circle${selectedCircles.length > 1 ? 's' : ''}`
        : 'Select Circles';
      default: return 'Everyone';
    }
  };
  
  // Get audience icon for display
  const getAudienceIcon = () => {
    switch (audience) {
      case 'everyone': return <Globe className="h-4 w-4" />;
      case 'friends': return <Users className="h-4 w-4" />;
      case 'just_me': return <Lock className="h-4 w-4" />;
      case 'friend_group': return <Users className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button className="rounded-full px-4 py-2 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm flex items-center hover:bg-primary-100 dark:hover:bg-primary-800/40">
            <PenSquare className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">Create Post</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <AvatarWithRing 
              user={user!} 
              emotionIds={selectedEmotions}
            />
            
            <div>
              <h3 className="font-medium text-sm">{user?.profile?.display_name}</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-1 h-7 text-xs">
                    {getAudienceIcon()}
                    <span className="mx-1">{getAudienceLabel()}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Who can see this?</h4>
                    <RadioGroup value={audience} onValueChange={setAudience}>
                      <div className="flex items-center space-x-2 py-1">
                        <RadioGroupItem value="everyone" id="everyone" />
                        <Label htmlFor="everyone" className="flex items-center cursor-pointer">
                          <Globe className="h-4 w-4 mr-2 text-gray-600" />
                          <span>Everyone</span>
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2 py-1">
                        <RadioGroupItem value="friends" id="friends" />
                        <Label htmlFor="friends" className="flex items-center cursor-pointer">
                          <Users className="h-4 w-4 mr-2 text-gray-600" />
                          <span>Connections</span>
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2 py-1">
                        <RadioGroupItem value="friend_group" id="friend_group" />
                        <Label htmlFor="friend_group" className="flex items-center cursor-pointer">
                          <Users className="h-4 w-4 mr-2 text-blue-600" />
                          <span>Circles</span>
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2 py-1">
                        <RadioGroupItem value="just_me" id="just_me" />
                        <Label htmlFor="just_me" className="flex items-center cursor-pointer">
                          <Lock className="h-4 w-4 mr-2 text-gray-600" />
                          <span>Just Me</span>
                        </Label>
                      </div>
                    </RadioGroup>
                    
                    {audience === 'friend_group' && (
                      <div className="pt-2">
                        <Label className="text-xs mb-1 block">Select circles</Label>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {friendGroups.map(group => (
                            <div key={group.friend_group_id} className="flex items-center">
                              <input 
                                type="checkbox"
                                id={`circle-${group.friend_group_id}`}
                                value={group.friend_group_id}
                                checked={selectedCircles.includes(group.friend_group_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCircles([...selectedCircles, group.friend_group_id]);
                                  } else {
                                    setSelectedCircles(selectedCircles.filter(id => id !== group.friend_group_id));
                                  }
                                }}
                                className="mr-2"
                              />
                              <Label htmlFor={`circle-${group.friend_group_id}`} className="text-xs cursor-pointer">
                                {group.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <Textarea
            placeholder="What's on your mind?"
            className="min-h-[120px] resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          
          {previewUrl && (
            <div className="relative rounded-lg overflow-hidden border">
              <img 
                src={previewUrl} 
                alt="Upload preview" 
                className="w-full max-h-[200px] object-contain"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 rounded-full"
                onClick={handleRemoveMedia}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div>
            <h4 className="font-medium text-sm mb-2">How are you feeling?</h4>
            <EmotionSelector 
              emotions={emotions}
              selectedEmotions={selectedEmotions}
              onChange={setSelectedEmotions}
            />
          </div>
          
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="shadow-session-switch" className="font-medium text-sm">
                Make this a Shadow Session
              </Label>
              <Switch 
                id="shadow-session-switch"
                checked={isShadowSession}
                onCheckedChange={setIsShadowSession}
              />
            </div>
            
            {isShadowSession && (
              <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <Label htmlFor="session-title" className="text-xs mb-1 block">Session Title</Label>
                  <input 
                    id="session-title"
                    type="text"
                    className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm"
                    placeholder="e.g., Morning Coffee & Reading"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !sessionDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {sessionDate ? format(sessionDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={sessionDate}
                          onSelect={setSessionDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div>
                    <Label htmlFor="timezone" className="text-xs mb-1 block">Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger id="timezone" className="h-9 text-xs">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="start-time" className="text-xs mb-1 block">Start Time</Label>
                    <input 
                      id="start-time"
                      type="time"
                      className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="end-time" className="text-xs mb-1 block">End Time</Label>
                    <input 
                      id="end-time"
                      type="time"
                      className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <Separator className="my-2" />
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                className="text-sm" 
                type="button"
                onClick={() => document.getElementById('media-upload')?.click()}
              >
                <Image className="h-4 w-4 mr-2" />
                Add Photo
              </Button>
              <input 
                type="file" 
                id="media-upload" 
                className="hidden" 
                accept="image/*"
                onChange={handleMediaChange}
              />
              
              <Button 
                variant="outline" 
                size="sm"
                className="text-sm" 
                type="button"
                onClick={() => setIsShadowSession(!isShadowSession)}
              >
                <SmilePlus className="h-4 w-4 mr-2" />
                {isShadowSession ? 'Simple Post' : 'Shadow Session'}
              </Button>
            </div>
            
            <Button 
              type="submit" 
              disabled={createPostMutation.isPending} 
              onClick={handleSubmit}
            >
              {createPostMutation.isPending ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
