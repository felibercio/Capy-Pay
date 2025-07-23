'use client';

import React from 'react';
import Link from 'next/link';
import { 
  FiCreditCard, 
  FiFileText, 
  FiUsers, 
  FiList, 
  FiStar,
  FiRefreshCcw,
  FiTrendingUp,
  FiWifi,
  FiShield,
  FiShare2
} from 'react-icons/fi';

interface MenuItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ href, icon: Icon, label }) => {
  return (
    <Link 
      href={href} 
      className="flex flex-col items-center justify-center p-4 hover:bg-capy-light/50 rounded-capy-sm transition-colors duration-200"
    >
      <Icon className="w-8 h-8 text-capy-brown mb-2" />
      <span className="text-sm font-medium text-capy-dark text-center">{label}</span>
    </Link>
  );
};

export default function TopMenu() {
  const menuItems: MenuItemProps[] = [
    {
      href: '/pix',
      icon: FiCreditCard,
      label: 'PIX'
    },
    {
      href: '/pagar-boleto',
      icon: FiFileText,
      label: 'Pagar Boleto'
    },
    {
      href: '/staking',
      icon: FiTrendingUp,
      label: 'Staking'
    },
    {
      href: '/points',
      icon: FiStar,
      label: 'Pontos'
    },
    {
      href: '/referral',
      icon: FiShare2,
      label: 'Indique e Ganhe'
    },
    {
      href: '/transactions',
      icon: FiList,
      label: 'Transações'
    },
    {
      href: '/limit-kyc',
      icon: FiShield,
      label: 'Meus Limites'
    },
    {
      href: '/connect-wallet',
      icon: FiWifi,
      label: 'Carteira'
    }
  ];

  return (
    <div className="capy-card mb-6">
      <div className="grid grid-cols-4 gap-2 md:grid-cols-4 lg:grid-cols-8">
        {menuItems.map((item) => (
          <MenuItem 
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </div>
    </div>
  );
} 