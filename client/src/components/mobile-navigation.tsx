import { FC } from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, Sparkles, CalendarDays, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const MobileNavigation: FC = () => {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/connections", icon: Users, label: "Connections" },
    { href: "/circles", icon: UserCircle, label: "Circles" },
    { href: "/spaces", icon: Sparkles, label: "Spaces" },
    { href: "/shadow-sessions", icon: CalendarDays, label: "Sessions" }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-30">
      <div className="flex justify-around items-center h-16">
        {navItems.map(item => (
          <Link key={item.href} href={item.href}>
            <a className={cn(
              "flex flex-col items-center p-2",
              location === item.href 
                ? "text-primary-600 dark:text-primary-400" 
                : "text-gray-500 dark:text-gray-400"
            )}>
              <item.icon className="text-lg h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
};
