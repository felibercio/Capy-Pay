'use client';

import React from 'react';
import { FileText, Camera } from 'lucide-react';

interface BillPaymentProps {
  onClose?: () => void;
}

export default function BillPayment({ onClose }: BillPaymentProps) {
  const [billCode, setBillCode] = React.useState('');
  const balance = 0.000;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-capy-dark mb-2">
          Balance
        </label>
        <div className="capy-input bg-capy-light text-center text-2xl font-bold">
          {balance.toFixed(3)}
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-capy-dark mb-2">
          Bill Code
        </label>
        <div className="relative">
          <input
            type="text"
            value={billCode}
            onChange={(e) => setBillCode(e.target.value)}
            placeholder="Enter bill barcode"
            className="capy-input pr-12"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2">
            <Camera className="w-6 h-6 text-capy-brown" />
          </button>
        </div>
      </div>
      
      <div className="py-4">
        <button 
          className="capy-button w-full"
          disabled={!billCode || balance === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
} 