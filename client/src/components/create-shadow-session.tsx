import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { TimePicker } from "@/components/ui/time-picker";
import { EmotionSelector } from "@/components/ui/emotion-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Emotion } from "@/types";

const shadowSessionSchema = z.object({
  title: z.string().min(3, "Title is required").max(100),
  startDate: z.date(),
  startTime: z.string(),
  endDate: z.date(),
  endTime: z.string(),
  audience: z.enum(["everyone", "friends", "just_me", "friend_group", "group"]),
});

export function CreateShadowSession() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [selectedEmotions, setSelectedEmotions] = useState<number[]>([]);
  
  const { data: emotions = [] } = useQuery<Emotion[]>({
    queryKey: ["/api/emotions"],
  });
  
  const form = useForm<z.infer<typeof shadowSessionSchema>>({
    resolver: zodResolver(shadowSessionSchema),
    defaultValues: {
      title: "",
      startDate: new Date(),
      startTime: "12:00",
      endDate: new Date(),
      endTime: "13:00",
      audience: "everyone",
    },
  });
  
  const createSessionMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/posts", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shadow-sessions/upcoming"] });
      form.reset();
      setContent("");
      setSelectedEmotions([]);
      toast({
        title: "Shadow session created",
        description: "Your shadow session has been scheduled!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create shadow session",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: z.infer<typeof shadowSessionSchema>) => {
    if (selectedEmotions.length === 0) {
      toast({
        title: "Emotions required",
        description: "Please select at least one emotion for your shadow session.",
        variant: "destructive",
      });
      return;
    }
    
    // Create start and end datetime objects
    const startDateTime = new Date(values.startDate);
    const [startHours, startMinutes] = values.startTime.split(":").map(Number);
    startDateTime.setHours(startHours, startMinutes);
    
    const endDateTime = new Date(values.endDate);
    const [endHours, endMinutes] = values.endTime.split(":").map(Number);
    endDateTime.setHours(endHours, endMinutes);
    
    // Check that end is after start
    if (endDateTime <= startDateTime) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("content", content);
    formData.append("audience", values.audience);
    formData.append("emotion_ids", JSON.stringify(selectedEmotions));
    formData.append("is_shadow_session", "true");
    formData.append("session_title", values.title);
    formData.append("starts_at", startDateTime.toISOString());
    formData.append("ends_at", endDateTime.toISOString());
    formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    createSessionMutation.mutate(formData);
  };
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 border rounded-lg">
      <h2 className="text-xl font-medium">Create a Shadow Session</h2>
      
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Session Title</label>
        <Input
          placeholder="Reading together in silence"
          {...form.register("title")}
        />
        {form.formState.errors.title && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.title.message}</p>
        )}
      </div>
      
      {/* Start Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(form.watch("startDate"), "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch("startDate")}
                onSelect={(date) => date && form.setValue("startDate", date)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start Time</label>
          <TimePicker
            value={form.watch("startTime")}
            onChange={(time: string) => form.setValue("startTime", time)}
          />
        </div>
      </div>
      
      {/* End Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(form.watch("endDate"), "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch("endDate")}
                onSelect={(date) => date && form.setValue("endDate", date)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Time</label>
          <TimePicker
            value={form.watch("endTime")}
            onChange={(time: string) => form.setValue("endTime", time)}
          />
        </div>
      </div>
      
      {/* Description and emotions */}
      <div>
        <label className="block text-sm font-medium mb-1">Session Description</label>
        <Textarea
          placeholder="What will this shadow session be about?"
          className="min-h-[100px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      {/* Audience Selector */}
      <div>
        <label className="block text-sm font-medium mb-1">Who can see this?</label>
        <Select
          defaultValue={form.getValues("audience")}
          onValueChange={(value) => form.setValue("audience", value as any)}
          disabled={createSessionMutation.isPending}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select audience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everyone">Everyone</SelectItem>
            <SelectItem value="friends">Friends Only</SelectItem>
            <SelectItem value="just_me">Just Me</SelectItem>
            <SelectItem value="friend_group">Specific Friend Group</SelectItem>
            <SelectItem value="group">Specific Space</SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.audience && (
          <p className="text-xs text-red-500 mt-1">{form.formState.errors.audience.message}</p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Emotions for this session</label>
        <EmotionSelector
          emotions={emotions}
          selectedEmotions={selectedEmotions}
          onChange={setSelectedEmotions}
          max={3}
          disabled={createSessionMutation.isPending}
        />
      </div>
      
      <Button
        type="submit"
        className="w-full"
        disabled={createSessionMutation.isPending}
      >
        {createSessionMutation.isPending ? "Creating Session..." : "Create Shadow Session"}
      </Button>
    </form>
  );
}