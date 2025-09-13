import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";

interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: ReactNode;
  variant?: 'default' | 'accent' | 'lime';
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
  children?: ReactNode;
}

export function MetricCard({ 
  label, 
  value, 
  icon, 
  variant = 'default', 
  size = 'md',
  testId,
  className,
  children,
  ...props 
}: MetricCardProps) {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4', 
    lg: 'p-6'
  };

  const textSizes = {
    sm: { label: 'text-xs', value: 'text-lg font-bold' },
    md: { label: 'text-xs md:text-sm', value: 'text-lg md:text-2xl font-extrabold' },
    lg: { label: 'text-sm', value: 'text-3xl font-extrabold' }
  };

  const variantClasses = {
    default: 'metric-card',
    accent: 'metric-card-accent', 
    lime: 'metric-card-lime'
  };

  return (
    <div 
      className={cn(variantClasses[variant], sizeClasses[size], className)}
      data-testid={testId}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className={cn(
            textSizes[size].label, 
            variant === 'default' ? 'text-gray-500' : 'opacity-90'
          )}>
            {label}
          </div>
          <div className={cn(textSizes[size].value, "mt-1 tabular-nums tracking-tight")}>
            {value}
          </div>
        </div>
        {icon && (
          <div className={cn(
            "ml-3 flex-shrink-0",
            variant === 'default' ? 'text-gray-400' : 'opacity-80'
          )}>
            {icon}
          </div>
        )}
      </div>
      {children && (
        <div className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
}