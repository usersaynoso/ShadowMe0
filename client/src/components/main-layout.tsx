import { FC, ReactNode } from "react";
import { Header } from "./header";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { MobileNavigation } from "./mobile-navigation";
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

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 pb-20 md:pb-10 pt-6">
        {(() => {
          // Desktop grid logic
          if (showLeftSidebar && showRightSidebar && !isMobile) {
            // Both sidebars
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <aside className="hidden md:block">
                  <LeftSidebar />
                </aside>
                <div className="md:col-span-1 col-span-full">
                  {children}
                </div>
                <aside className="hidden lg:block">
                  <RightSidebar />
                </aside>
              </div>
            );
          } else if (showLeftSidebar && !showRightSidebar && !isMobile) {
            // Only left sidebar
            return (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <aside className="hidden md:block">
                  <LeftSidebar />
                </aside>
                <div className="md:col-span-3 col-span-full">
                  {children}
                </div>
              </div>
            );
          } else if (!showLeftSidebar && showRightSidebar && !isMobile) {
            // Only right sidebar
            return (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 col-span-full">
                  {children}
                </div>
                <aside className="hidden lg:block">
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
      
      {isMobile && <MobileNavigation />}
    </div>
  );
};
