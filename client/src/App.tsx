import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ConnectionsPage from "@/pages/connections-page";
import SpacesPage from "@/pages/spaces-page";
import CirclesPage from "@/pages/circles-page";
import ShadowSessionsPage from "@/pages/shadow-sessions-page";
import ProfilePage from "@/pages/profile-page";
import { ShadowSessionViewPage } from "@/pages/shadow-session-view";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { useEffect } from "react";

// Wrapper to debug routing
function RouteLogger() {
  const [location] = useLocation();
  
  useEffect(() => {
    console.log('Route changed to:', location);
  }, [location]);
  
  return null;
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={() => <HomePage />} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/connections" component={() => <ConnectionsPage />} />
      <ProtectedRoute path="/circles" component={() => <CirclesPage />} />
      <ProtectedRoute path="/spaces" component={() => <SpacesPage />} />
      <ProtectedRoute path="/shadow-sessions" component={() => <ShadowSessionsPage />} />
      <ProtectedRoute path="/shadow-sessions/:sessionId" component={() => <ShadowSessionViewPage />} />
      <ProtectedRoute path="/profile/:userId?" component={() => <ProfilePage />} />
      <ProtectedRoute path="/profile" component={() => <ProfilePage />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <RouteLogger />
        <Toaster />
        <Router />
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
