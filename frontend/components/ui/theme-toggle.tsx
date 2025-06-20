"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(true);

  return (
    <button
      className={`flex items-center justify-center w-9 h-9 rounded-full border border-border bg-background shadow hover:bg-muted transition-colors ${className}`}
      onClick={() => setIsDark(!isDark)}
      aria-label="Toggle dark mode"
      type="button"
    >
      {isDark ? (
        <Moon className="w-5 h-5 text-foreground" />
      ) : (
        <Sun className="w-5 h-5 text-yellow-400" />
      )}
    </button>
  );
}
