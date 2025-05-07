import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./hooks/use-auth";
import { ErrorBoundary } from "./components/error-boundary";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

// Add debugging console logs
console.log('main.tsx: Starting application');

try {
  const rootElement = document.getElementById("root");
  console.log('main.tsx: Root element found:', rootElement);
  
  if (rootElement) {
    const root = createRoot(rootElement);
    console.log('main.tsx: Root created successfully');
    
    root.render(
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <App />
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
    console.log('main.tsx: Render called');
  } else {
    console.error('main.tsx: Root element not found!');
  }
} catch (error) {
  console.error('main.tsx: Fatal error during initialization:', error);
}
