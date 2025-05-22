import { FC, ReactNode, useState } from "react";
import { Header } from "./header";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { MobileNavigation } from "./mobile-navigation";
import { MessagesPanel } from "./MessagesPanel";
import { useIsMobile } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: ReactNode;
  showLeftSidebar?: boolean;
  showRightSidebar?: boolean;
}

export const MainLayout: FC<MainLayoutProps> = ({ 
  children,
  showLeftSidebar = true,
  showRightSidebar = true
}) => {
  const isMobile = useIsMobile();
  const [isMessagesPanelOpen, setIsMessagesPanelOpen] = useState(false);

  const toggleMessagesPanel = () => {
    setIsMessagesPanelOpen(prev => !prev);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 pb-20 md:pb-10 pt-6">
        {(() => {
          // Desktop grid logic
          if (showLeftSidebar && showRightSidebar && !isMobile) {
            // Both sidebars
            return (
              <div className="grid grid-cols-12 gap-6">
                <aside className="hidden md:block col-span-3">
                  <LeftSidebar />
                </aside>
                <div className="col-span-12 md:col-span-6">
                  {children}
                </div>
                <aside className="hidden lg:block col-span-3">
                  <RightSidebar />
                </aside>
              </div>
            );
          } else if (showLeftSidebar && !showRightSidebar && !isMobile) {
            // Only left sidebar
            return (
              <div className="grid grid-cols-12 gap-6">
                <aside className="hidden md:block col-span-3">
                  <LeftSidebar />
                </aside>
                <div className="col-span-12 md:col-span-9">
                  {children}
                </div>
              </div>
            );
          } else if (!showLeftSidebar && showRightSidebar && !isMobile) {
            // Only right sidebar
            return (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-9">
                  {children}
                </div>
                <aside className="hidden lg:block col-span-3">
                  <RightSidebar />
                </aside>
              </div>
            );
          } else {
            // No sidebars or mobile
            return (
              <div className="grid grid-cols-1 gap-6">
                <div className="col-span-full">
                  {children}
                </div>
              </div>
            );
          }
        })()}
      </main>
      
      {isMobile && <MobileNavigation onMessagesClick={toggleMessagesPanel} />}
      {isMobile && (
        <MessagesPanel isOpen={isMessagesPanelOpen} onClose={toggleMessagesPanel} />
      )}
    </div>
  );
};
