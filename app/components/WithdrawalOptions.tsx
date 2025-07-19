'use client';

import React from 'react';
import { Banknote, CreditCard, Building } from 'lucide-react';

interface WithdrawalOptionsProps {
  onClose?: () => void;
}

export default function WithdrawalOptions({ onClose }: WithdrawalOptionsProps) {
  const withdrawalMethods = [
    {
      id: 'pix',
      name: 'PIX',
      description: 'Instant transfer',
      icon: Banknote,
      time: 'Immediate'
    },
    {
      id: 'ted',
      name: 'TED',
      description: 'Same day transfer',
      icon: Building,
      time: 'Same day'
    },
    {
      id: 'card',
      name: 'Debit Card',
      description: 'Card withdrawal',
      icon: CreditCard,
      time: '1-3 days'
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-capy-dark mb-4">
        Choose withdrawal method
      </h3>
      
      {withdrawalMethods.map((method) => (
        <button
          key={method.id}
          className="w-full p-4 bg-capy-light rounded-2xl hover:bg-capy-cream 
                     transition-colors duration-200 flex items-center justify-between
                     border-2 border-transparent hover:border-capy-brown"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-capy-brown rounded-full flex items-center justify-center">
              <method.icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h4 className="font-semibold text-capy-dark">{method.name}</h4>
              <p className="text-sm text-gray-600">{method.description}</p>
            </div>
          </div>
          <span className="text-sm text-capy-brown font-medium">
            {method.time}
          </span>
        </button>
      ))}
    </div>
  );
} 