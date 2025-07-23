import React from 'react';

interface CapyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Componente da Logo do Capy Pay
 * 
 * Exemplo de uso:
 * ```tsx
 * // Logo pequena para headers
 * <CapyLogo size="sm" />
 * 
 * // Logo média para cards
 * <CapyLogo size="md" />
 * 
 * // Logo grande para splash screens
 * <CapyLogo size="lg" />
 * 
 * // Com classes customizadas
 * <CapyLogo size="md" className="animate-pulse" />
 * ```
 */
export const CapyLogo: React.FC<CapyLogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
  };

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {/* Círculo de fundo azul claro/teal */}
      <div className="absolute inset-0 bg-capy-teal rounded-full" />
      
      {/* Capivara SVG baseada na descrição */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full p-3"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Corpo da capivara - marrom médio */}
        <ellipse cx="50" cy="65" rx="28" ry="22" fill="#E89B4B" />
        
        {/* Cabeça */}
        <circle cx="50" cy="38" r="18" fill="#E89B4B" />
        
        {/* Orelhas pequenas e arredondadas */}
        <circle cx="38" cy="32" r="4" fill="#E89B4B" />
        <circle cx="62" cy="32" r="4" fill="#E89B4B" />
        
        {/* Olhos fechados - linhas curvas simples */}
        <path
          d="M 38 36 Q 40 34 42 36"
          stroke="#2C3E2D"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 58 36 Q 60 34 62 36"
          stroke="#2C3E2D"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Nariz - pequeno ponto azul escuro */}
        <circle cx="50" cy="42" r="1.5" fill="#2C3E2D" />
        
        {/* Sorriso gentil - linha curva para cima */}
        <path
          d="M 42 46 Q 50 50 58 46"
          stroke="#2C3E2D"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}; 