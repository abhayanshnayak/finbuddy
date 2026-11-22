import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ theme, toggleTheme, className = '' }) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-line bg-surface hover:bg-subtle text-ink-secondary hover:text-ink transition-colors cursor-pointer ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Moon className="w-4 h-4" aria-hidden="true" />
      )}
    </button>
  );
}
