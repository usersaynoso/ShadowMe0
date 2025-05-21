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
import SpaceViewPage from "@/pages/spaces-[spaceId]";
import ArkPage from "@/pages/admin/ArkPage";
import SettingsPage from "@/pages/SettingsPage";
import MessagesPage from "@/pages/messages";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider, useAuth } from "./hooks/use-auth";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={() => <HomePage />} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/connections" component={() => <ConnectionsPage />} />
      <ProtectedRoute path="/circles" component={() => <CirclesPage />} />
      <ProtectedRoute path="/spaces" component={() => <SpacesPage />} />
      <ProtectedRoute path="/spaces/:spaceId" component={() => <SpaceViewPage />} />
      <ProtectedRoute path="/shadow-sessions" component={() => <ShadowSessionsPage />} />
      <ProtectedRoute path="/shadow-sessions/:sessionId" component={() => <ShadowSessionViewPage />} />
      <ProtectedRoute path="/profile/:userId?" component={() => <ProfilePage />} />
      <ProtectedRoute path="/profile" component={() => <ProfilePage />} />
      <ProtectedRoute path="/settings" component={() => <SettingsPage />} />
      <ProtectedRoute path="/messages" component={() => <MessagesPage />} />
      <ProtectedRoute 
        path="/ark" 
        component={() => <ArkPage />} 
        allowedRoles={['admin']}
      />
      <Route component={NotFound} />
    </Switch>
  );
}

// New component to contain the app's content
function AppContent() {
  const { user } = useAuth();

  return (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
