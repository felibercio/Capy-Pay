import React from 'react';
import { cn } from '@/lib/utils';

interface CapyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CapyLogo: React.FC<CapyLogoProps> = ({ 
  size = 'md', 
  className 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className={cn(
      'rounded-full bg-teal-400 flex items-center justify-center',
      sizeClasses[size],
      className
    )}>
      {/* Simplified capybara face icon */}
      <div className="relative">
        {/* Capybara face */}
        <div className="w-8 h-6 bg-amber-600 rounded-full relative">
          {/* Eyes */}
          <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
          {/* Nose */}
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-slate-700 rounded-full"></div>
          {/* Ears */}
          <div className="absolute -top-1 left-1 w-2 h-2 bg-amber-600 rounded-full"></div>
          <div className="absolute -top-1 right-1 w-2 h-2 bg-amber-600 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

// Alternative SVG version for better quality
export const CapyLogoSVG: React.FC<CapyLogoProps> = ({ 
  size = 'md', 
  className 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className={cn(
      'rounded-full bg-teal-400 flex items-center justify-center',
      sizeClasses[size],
      className
    )}>
      <svg 
        viewBox="0 0 32 32" 
        className="w-6 h-6"
        fill="none"
      >
        {/* Capybara head */}
        <ellipse cx="16" cy="18" rx="10" ry="8" fill="#D97706"/>
        
        {/* Ears */}
        <ellipse cx="10" cy="12" rx="2" ry="3" fill="#D97706"/>
        <ellipse cx="22" cy="12" rx="2" ry="3" fill="#D97706"/>
        
        {/* Eyes */}
        <circle cx="12" cy="16" r="1.5" fill="#1F2937"/>
        <circle cx="20" cy="16" r="1.5" fill="#1F2937"/>
        
        {/* Nose */}
        <ellipse cx="16" cy="20" rx="1" ry="0.5" fill="#374151"/>
        
        {/* Mouth */}
        <path d="M14 22 Q16 23 18 22" stroke="#374151" strokeWidth="0.5" fill="none"/>
      </svg>
    </div>
  );
}; 