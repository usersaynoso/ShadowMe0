import { FC, useState } from "react";
import { Link, useLocation } from "wouter";
import { AvatarWithEmotion } from "@/components/ui/avatar-with-emotion";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { 
  Home, 
  Users, 
  Sparkles, 
  CalendarDays, 
  Search, 
  Bell, 
  Settings, 
  LogOut, 
  Sun, 
  Moon, 
  UserCircle,
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from '@/components/ui/notification-bell';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MessageNotificationBadge } from '@/components/ui/message-notification-badge';

export const Header: FC = () => {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/messages", icon: MessageCircle, label: "Messages", hasBadge: true },
    { href: "/connections", icon: Users, label: "Connections" },
    { href: "/circles", icon: UserCircle, label: "Circles" },
    { href: "/spaces", icon: Sparkles, label: "Spaces" },
    { href: "/shadow-sessions", icon: CalendarDays, label: "Shadow Sessions" }
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white dark:bg-gray-800 shadow-sm">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/">
          <span className="flex items-center space-x-2 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <h1 className="text-xl font-semibold text-primary-600 dark:text-primary-400">Shadow Me</h1>
          </span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center font-medium cursor-pointer relative",
              location === item.href 
                ? "text-primary-600 dark:text-primary-400" 
                : "text-gray-500 hover:text-primary-600 dark:hover:text-primary-400"
            )}>
              <div className="relative">
                <item.icon className="mr-1 h-4 w-4" />
                {/* {item.hasBadge && <MessageNotificationBadge />} */}
              </div>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        
        {/* User Menu & Search */}
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            title="Log out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
          
          {/* User Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="p-0 rounded-full">
                <AvatarWithEmotion 
                  user={user!}
                  className="cursor-pointer" 
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link href="/profile" className="flex items-center w-full">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                asChild
              >
                <Link href="/settings" className="flex items-center w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    <span>Dark Mode</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
