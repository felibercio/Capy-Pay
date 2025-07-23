import { LoadingSpinnerProps } from '@/types';
import { cn } from '@/utils/cn';
import { CapyLogo } from '@/components/CapyLogo';

export function LoadingSpinner({ size = 'md', className, variant = 'spinner' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  if (variant === 'logo') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <div className="animate-bounce-light">
          <CapyLogo size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-gray-200 border-t-primary-600',
          sizeClasses[size]
        )}
      />
    </div>
  );
} 