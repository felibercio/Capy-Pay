import React from 'react';

interface CapyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CapyLogo: React.FC<CapyLogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
  };

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {/* Círculo de fundo */}
      <div className="absolute inset-0 bg-capy-teal rounded-full" />
      
      {/* Capivara SVG simplificada */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full p-4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Corpo da capivara */}
        <ellipse cx="50" cy="60" rx="30" ry="25" fill="#E89B4B" />
        
        {/* Cabeça */}
        <circle cx="50" cy="40" r="20" fill="#E89B4B" />
        
        {/* Orelhas */}
        <circle cx="38" cy="35" r="5" fill="#E89B4B" />
        <circle cx="62" cy="35" r="5" fill="#E89B4B" />
        
        {/* Olhos */}
        <circle cx="42" cy="40" r="2" fill="#2C3E2D" />
        <circle cx="58" cy="40" r="2" fill="#2C3E2D" />
        
        {/* Nariz */}
        <ellipse cx="50" cy="45" rx="4" ry="3" fill="#B87333" />
        
        {/* Sorriso */}
        <path
          d="M 42 48 Q 50 52 58 48"
          stroke="#2C3E2D"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}; 