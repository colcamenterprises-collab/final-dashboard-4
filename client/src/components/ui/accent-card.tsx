import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";

interface AccentCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  progress?: number;
  accent?: 'lime' | 'emerald' | 'blue' | 'orange' | 'slate';
  testId?: string;
  children?: ReactNode;
}

export function AccentCard({ 
  title,
  value,
  subtitle,
  icon,
  progress,
  accent = 'slate',
  testId,
  className,
  children,
  ...props
}: AccentCardProps) {
  const accentClasses = {
    lime: 'accent-card-lime',
    emerald: 'accent-card-emerald',
    blue: 'accent-card-blue',
    orange: 'accent-card-orange',
    slate: 'accent-card-slate'
  };

  const progressColors = {
    lime: 'bg-slate-900/20',
    emerald: 'bg-white/20',
    blue: 'bg-white/20', 
    orange: 'bg-white/20',
    slate: 'bg-white/20'
  };

  return (
    <div 
      className={cn(
        'rounded-2xl border-0 p-6 shadow-sm', 
        accentClasses[accent],
        className
      )}
      data-testid={testId}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon && (
              <div className="opacity-90">
                {icon}
              </div>
            )}
            <div className="text-sm opacity-90">
              {title}
            </div>
          </div>
          <div className="text-2xl font-extrabold mt-1 tabular-nums">
            {value}
          </div>
          {subtitle && (
            <div className="text-xs opacity-75 mt-1">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      
      {progress !== undefined && (
        <div className="mt-4">
          <div className={cn("h-2 rounded-full", progressColors[accent])}>
            <div 
              className="h-2 rounded-full bg-white/40 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
      
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}