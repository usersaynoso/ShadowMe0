import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateShadowSession } from "./create-shadow-session";

interface CreateShadowSessionDialogProps {
  children: ReactNode;
}

export function CreateShadowSessionDialog({ children }: CreateShadowSessionDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Shadow Session</DialogTitle>
        </DialogHeader>
        <CreateShadowSession />
      </DialogContent>
    </Dialog>
  );
} 