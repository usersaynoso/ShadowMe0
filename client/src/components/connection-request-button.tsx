import { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User } from "@/types";
import { Check, Clock, UserMinus, UserPlus, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ConnectionStatus = "none" | "pending_outgoing" | "pending_incoming" | "connected";

interface ConnectionRequestButtonProps {
  targetUser: User;
  size?: "default" | "sm" | "lg" | "icon";
  showIcon?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  onConnectionChange?: (status: ConnectionStatus) => void;
}

export const ConnectionRequestButton: FC<ConnectionRequestButtonProps> = ({
  targetUser,
  size = "default",
  showIcon = true,
  variant = "default",
  className = "",
  onConnectionChange
}) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>("none");

  // Check current connection status with the target user
  const { isLoading } = useQuery({
    queryKey: [`/api/user/connection-status/${targetUser.user_id}`],
    queryFn: async () => {
      try {
        // Check if there's an existing connection
        const connections = await apiRequest("GET", "/api/user/connections");
        const connectionsData = await connections.json();
        
        if (connectionsData.some((connection: User) => connection.user_id === targetUser.user_id)) {
          setStatus("connected");
          return "connected";
        }
        
        // Check for pending requests
        const pendingRequests = await apiRequest("GET", "/api/user/connections/pending");
        const pendingData = await pendingRequests.json();
        
        if (pendingData.some((request: User) => request.user_id === targetUser.user_id)) {
          setStatus("pending_incoming");
          return "pending_incoming";
        }
        
        // We don't have a direct API to check outgoing requests, so we'll assume none for now
        setStatus("none");
        return "none";
      } catch (error) {
        console.error("Error checking connection status:", error);
        return "none";
      }
    },
    enabled: !!targetUser.user_id,
  });

  // Send friend request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      if (!targetUser) return;
      return apiRequest("POST", `/api/friends/request/${targetUser.user_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/connection-suggestions"] });
      setStatus("pending_outgoing");
      if (onConnectionChange) onConnectionChange("pending_outgoing");
      toast({
        title: "Connection request sent",
        description: `Request sent to ${targetUser.profile?.display_name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Accept friend request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: async () => {
      if (!targetUser) return;
      return apiRequest("POST", `/api/friends/accept/${targetUser.user_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/connections/pending"] });
      setStatus("connected");
      if (onConnectionChange) onConnectionChange("connected");
      toast({
        title: "Connection accepted",
        description: `You are now connected with ${targetUser.profile?.display_name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject friend request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async () => {
      if (!targetUser) return;
      return apiRequest("DELETE", `/api/friends/request/${targetUser.user_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/connections/pending"] });
      setStatus("none");
      if (onConnectionChange) onConnectionChange("none");
      toast({
        title: "Request rejected",
        description: `Connection request from ${targetUser.profile?.display_name} rejected`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reject request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove friend mutation
  const removeConnectionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/friends", { friend_id: targetUser.user_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/connections"] });
      setStatus("none");
      if (onConnectionChange) onConnectionChange("none");
      toast({
        title: "Connection removed",
        description: `${targetUser.profile?.display_name} has been removed from your connections`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Button size={size} variant="outline" disabled className={className}>
        Loading...
      </Button>
    );
  }

  switch (status) {
    case "none":
      return (
        <Button
          size={size}
          variant={variant}
          className={className}
          onClick={() => sendRequestMutation.mutate()}
          disabled={sendRequestMutation.isPending}
        >
          {showIcon && <UserPlus className="h-4 w-4 mr-2" />}
          {sendRequestMutation.isPending ? "Sending..." : "Connect"}
        </Button>
      );
    
    case "pending_outgoing":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size={size}
                variant="outline"
                className={className}
                disabled
              >
                {showIcon && <Clock className="h-4 w-4 mr-2" />}
                Request Sent
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Connection request pending</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    
    case "pending_incoming":
      return (
        <div className="flex space-x-2">
          <Button
            size={size}
            variant="default"
            className={className}
            onClick={() => acceptRequestMutation.mutate()}
            disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
          >
            {showIcon && <Check className="h-4 w-4 mr-2" />}
            Accept
          </Button>
          <Button
            size={size}
            variant="outline"
            className={className}
            onClick={() => rejectRequestMutation.mutate()}
            disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
          >
            {showIcon && <X className="h-4 w-4 mr-2" />}
            Decline
          </Button>
        </div>
      );
    
    case "connected":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size={size}
                variant="outline"
                className={`text-gray-500 hover:text-red-500 ${className}`}
                onClick={() => removeConnectionMutation.mutate()}
                disabled={removeConnectionMutation.isPending}
              >
                {showIcon && <UserMinus className="h-4 w-4 mr-2" />}
                {removeConnectionMutation.isPending ? "Removing..." : "Connected"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to remove connection</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    
    default:
      return null;
  }
}; 