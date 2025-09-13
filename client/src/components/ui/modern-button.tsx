import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ModernButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const ModernButton = forwardRef<HTMLButtonElement, ModernButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, children, disabled, ...props }, ref) => {
    const baseClasses = "modern-button inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
      primary: "modern-button-primary hover:shadow-md",
      secondary: "modern-button-secondary hover:shadow-sm", 
      accent: "accent-card-slate hover:opacity-90",
      ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm rounded-lg",
      md: "px-4 py-2 text-sm rounded-xl", 
      lg: "px-6 py-3 text-base rounded-xl"
    };

    return (
      <button
        className={cn(
          baseClasses,
          variants[variant],
          sizes[size], 
          loading && "cursor-wait",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading}
        ref={ref}
        {...props}
      >
        {loading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

ModernButton.displayName = "ModernButton";