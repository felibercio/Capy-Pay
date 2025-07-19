import React from 'react';
import { cn } from '@/lib/utils';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightElement?: React.ReactNode;
}

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, label, error, rightElement, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            className={cn(
              // Base input styles matching the image design
              'w-full px-4 py-3 bg-white rounded-2xl border border-green-200',
              'text-slate-800 placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent',
              'transition-all duration-200',
              // Error state
              error && 'border-red-300 focus:ring-red-500',
              // Right element spacing
              rightElement && 'pr-12',
              className
            )}
            ref={ref}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = 'InputField';

// Select Field component for dropdowns like in the swap screen
interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            className={cn(
              // Base select styles matching the image design
              'w-full px-4 py-3 bg-white rounded-2xl border border-green-200',
              'text-slate-800 appearance-none cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent',
              'transition-all duration-200',
              // Error state
              error && 'border-red-300 focus:ring-red-500',
              className
            )}
            ref={ref}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {/* Dropdown arrow */}
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className="text-slate-400"
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

SelectField.displayName = 'SelectField';

// Balance Display component for showing balances like in the image
interface BalanceDisplayProps {
  amount: string;
  currency?: string;
  variant?: 'large' | 'medium' | 'small';
  className?: string;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  amount,
  currency,
  variant = 'medium',
  className
}) => {
  return (
    <div className={cn(
      'bg-white rounded-2xl p-4 border border-green-200',
      className
    )}>
      <div className={cn(
        'font-semibold text-slate-800',
        {
          'text-3xl': variant === 'large',
          'text-xl': variant === 'medium',
          'text-lg': variant === 'small',
        }
      )}>
        {currency && <span className="text-slate-500 mr-1">{currency}</span>}
        {amount}
      </div>
    </div>
  );
}; 