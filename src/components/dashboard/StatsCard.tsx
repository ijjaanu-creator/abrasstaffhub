import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-primary/5 border-primary/20',
  success: 'bg-success/5 border-success/20',
  warning: 'bg-warning/5 border-warning/20',
  danger: 'bg-destructive/5 border-destructive/20',
};

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

export const StatsCard = forwardRef<HTMLDivElement, StatsCardProps>(
  ({ title, value, icon: Icon, trend, variant = 'default', className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-xl border p-4 lg:p-6 shadow-elegant transition-all duration-300 hover:shadow-lg',
          variantStyles[variant],
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs lg:text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-xl lg:text-3xl font-bold font-display text-foreground">{value}</p>
            {trend && (
              <p
                className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}% from last month
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl',
              iconVariantStyles[variant]
            )}
          >
            <Icon className="h-5 w-5 lg:h-6 lg:w-6" />
          </div>
        </div>
      </div>
    );
  }
);

StatsCard.displayName = 'StatsCard';
