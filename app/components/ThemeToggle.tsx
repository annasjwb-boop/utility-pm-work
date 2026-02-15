'use client';

import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="theme-toggle-btn flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all duration-300"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <SunMedium className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
