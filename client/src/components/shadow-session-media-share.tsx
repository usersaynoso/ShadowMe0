import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Image, Upload, X, Loader2, Check } from "lucide-react";

interface ShadowSessionMediaShareProps {
  sessionId: string;
  onShare?: () => void;
}

export function ShadowSessionMediaShare({ sessionId, onShare }: ShadowSessionMediaShareProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload media to session
  const uploadMediaMutation = useMutation({
    mutationFn: async () => {
      if (!file) return null;
      
      const formData = new FormData();
      formData.append("media", file);
      formData.append("sessionId", sessionId);
      
      const res = await apiRequest("POST", `/api/shadow-sessions/${sessionId}/media`, formData);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shadow-sessions', sessionId] });
      
      toast({
        title: "Media shared",
        description: "Your media has been shared with the session participants.",
      });
      
      // Clear file and preview
      setFile(null);
      setPreview(null);
      
      // Notify parent component
      if (onShare) onShare();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to share media",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check file type
      if (!selectedFile.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };
  
  // Handle file selection button click
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };
  
  // Handle upload button click
  const handleUpload = () => {
    if (file) {
      uploadMediaMutation.mutate();
    }
  };
  
  // Clear selected file
  const handleClear = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      {preview ? (
        <div className="relative">
          <img 
            src={preview} 
            alt="Preview" 
            className="max-h-[300px] w-full object-contain rounded-lg border" 
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      
      <div className="flex gap-2">
        {!preview ? (
          <Button
            variant="outline"
            className="w-full flex items-center justify-center"
            onClick={handleSelectFile}
          >
            <Image className="h-4 w-4 mr-2" />
            Select Image
          </Button>
        ) : (
          <Button
            className="w-full flex items-center justify-center"
            onClick={handleUpload}
            disabled={uploadMediaMutation.isPending}
          >
            {uploadMediaMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Share with Session
              </>
            )}
          </Button>
        )}
      </div>
      
      {uploadMediaMutation.isSuccess && (
        <div className="flex items-center justify-center p-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-300 rounded-lg">
          <Check className="h-4 w-4 mr-2" />
          Media shared successfully!
        </div>
      )}
    </div>
  );
} 