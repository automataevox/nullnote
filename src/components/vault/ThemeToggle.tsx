import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTheme, currentTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(currentTheme());
    // Follow the system if the user hasn't chosen a theme yet.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!localStorage.getItem("nullnote-theme")) {
        const t: Theme = mq.matches ? "dark" : "light";
        applyTheme(t);
        setThemeState(t);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle dark mode" className={className}
      onClick={() => setThemeState(toggleTheme())}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
