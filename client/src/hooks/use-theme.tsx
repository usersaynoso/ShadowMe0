import { useEffect, useState } from "react";
import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, systemTheme } = useNextTheme();
  const [isMounted, setIsMounted] = useState(false);

  // Ensure theme is only accessed client-side to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentTheme = isMounted ? theme : undefined;
  const resolvedTheme = currentTheme === 'system' ? systemTheme : currentTheme;

  return {
    theme: resolvedTheme,
    setTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
  };
}
