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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Sidebar */}
          {showLeftSidebar && !isMobile && (
            <aside className="hidden md:block">
              <LeftSidebar />
            </aside>
          )}
          
          {/* Main Content */}
          <div className={`${showLeftSidebar && showRightSidebar ? 'md:col-span-2' : 'col-span-full'}`}>
            {children}
          </div>
          
          {/* Right Sidebar */}
          {showRightSidebar && !isMobile && (
            <aside className="hidden lg:block">
              <RightSidebar />
            </aside>
          )}
        </div>
      </main>
      
      {isMobile && <MobileNavigation />}
    </div>
  );
};
