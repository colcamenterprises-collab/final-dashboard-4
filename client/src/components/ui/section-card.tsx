import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";

interface SectionCardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  headerAction?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
}

export function SectionCard({ 
  title, 
  subtitle,
  children, 
  headerAction,
  size = 'md',
  testId,
  className,
  ...props
}: SectionCardProps) {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div 
      className={cn('section-card', sizeClasses[size], className)}
      data-testid={testId}
      {...props}
    >
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && (
            <div className="flex-shrink-0">
              {headerAction}
            </div>
          )}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}