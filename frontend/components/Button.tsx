import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          // Variant styles
          {
            // Primary button - brown/golden color from image
            'bg-amber-700 text-white hover:bg-amber-800 active:bg-amber-900': variant === 'primary',
            // Secondary button - light cream color from image
            'bg-green-50 text-slate-700 hover:bg-green-100 active:bg-green-200 border border-green-200': variant === 'secondary',
            // Ghost button - transparent
            'hover:bg-green-50 text-slate-700': variant === 'ghost',
          },
          // Size styles
          {
            'h-9 px-4 py-2 text-sm': size === 'sm',
            'h-12 px-6 py-3 text-base': size === 'md',
            'h-14 px-8 py-4 text-lg': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button'; 