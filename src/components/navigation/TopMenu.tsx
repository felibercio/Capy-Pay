'use client';

import React from 'react';
import Link from 'next/link';
import { 
  FiHome, 
  FiCreditCard, 
  FiDollarSign, 
  FiTrendingUp, 
  FiUsers, 
  FiGift, 
  FiRefreshCcw,
  FiFileText,
  FiDroplet,
  FiTarget
} from 'react-icons/fi';

export default function TopMenu() {
  const menuItems = [
    {
      href: '/dashboard',
      icon: FiHome,
      label: 'Dashboard',
      description: 'Visão geral'
    },
    {
      href: '/pix',
      icon: FiCreditCard,
      label: 'PIX',
      description: 'Transferências'
    },
    {
      href: '/bill-payment',
      icon: FiFileText,
      label: 'Pagar Boleto',
      description: 'Contas e boletos'
    },
    {
      href: '/investimentos',
      icon: FiTrendingUp,
      label: 'Investimentos',
      description: 'Staking e rendimentos'
    },
    {
      href: '/pools',
      icon: FiDroplet,
      label: 'Pools',
      description: 'Liquidez'
    },
    {
      href: '/referral',
      icon: FiGift,
      label: 'Indicações',
      description: 'Programa de referência'
    },
    {
      href: '/points',
      icon: FiTarget,
      label: 'Pontos',
      description: 'Recompensas'
    },
    {
      href: '/transactions',
      icon: FiDollarSign,
      label: 'Transações',
      description: 'Histórico'
    }
  ];

  return (
    <div className="capy-card mb-6">
      <h3 className="text-lg font-semibold text-capy-dark mb-4">Menu Principal</h3>
      <div className="grid grid-cols-2 gap-3">
        {menuItems.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <Link
              key={index}
              href={item.href}
              className="flex items-center p-3 bg-white hover:bg-capy-teal/10 rounded-lg border border-gray-200 hover:border-capy-teal transition-all duration-200 group"
            >
              <IconComponent className="w-5 h-5 text-capy-brown group-hover:text-capy-teal mr-3 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-capy-dark group-hover:text-capy-teal">
                  {item.label}
                </div>
                <div className="text-xs text-capy-dark/60 group-hover:text-capy-teal/80 truncate">
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
} 