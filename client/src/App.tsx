import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ConnectionsPage from "@/pages/connections-page";
import SpacesPage from "@/pages/spaces-page";
import ShadowSessionsPage from "@/pages/shadow-sessions-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={() => <HomePage />} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/connections" component={() => <ConnectionsPage />} />
      <ProtectedRoute path="/spaces" component={() => <SpacesPage />} />
      <ProtectedRoute path="/shadow-sessions" component={() => <ShadowSessionsPage />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
