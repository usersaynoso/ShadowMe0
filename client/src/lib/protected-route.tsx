import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  allowedRoles,
}: {
  path: string;
  component: () => React.JSX.Element;
  allowedRoles?: string[];
}) {
  console.log(`ProtectedRoute: Initializing for path ${path}`);
  const { user, isLoading } = useAuth();
  console.log(`ProtectedRoute: path=${path}, isLoading=${isLoading}, user=`, user);

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.user_type)) {
    console.log(`ProtectedRoute: User role ${user.user_type} not in allowedRoles for path ${path}. Redirecting.`);
    return (
        <Route path={path}>
            <Redirect to="/" /> 
        </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
