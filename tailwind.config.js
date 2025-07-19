/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cores principais do Capy Pay
        'capy-teal': '#7ABDB0',        // Fundo principal verde-azulado
        'capy-cream': '#E8E2D5',       // Cards bege claro
        'capy-brown': '#B87333',       // Botões marrom/laranja
        'capy-brown-dark': '#9A5F2B',  // Hover dos botões
        'capy-dark': '#2C3E2D',        // Texto escuro
        'capy-light': '#F5F2ED',       // Fundo claro alternativo
        'capy-orange': '#E89B4B',      // Laranja da capivara
        'capy-pink': '#FFE4E1',        // Rosa claro para destaques
        
        // Cores de status
        'capy-success': '#4CAF50',
        'capy-error': '#F44336',
        'capy-warning': '#FF9800',
        'capy-info': '#2196F3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'capy': '24px',     // Bordas arredondadas dos cards
        'capy-sm': '16px',  // Bordas menores
        'capy-lg': '32px',  // Bordas maiores
      },
      boxShadow: {
        'capy': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'capy-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-light': 'bounceLight 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceLight: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
} 