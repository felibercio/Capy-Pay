import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../Card';
import { Button } from '../Button';
import { SelectField } from '../InputField';

interface SwapScreenProps {
  onBack: () => void;
  onContinue: (fromToken: string, toToken: string) => void;
}

export const SwapScreen: React.FC<SwapScreenProps> = ({
  onBack,
  onContinue,
}) => {
  const [fromToken, setFromToken] = useState('USD');
  const [toToken, setToToken] = useState('USDC');

  const tokenOptions = [
    { value: 'USD', label: 'USD' },
    { value: 'USDC', label: 'USDC' },
    { value: 'BRZ', label: 'BRZ' },
    { value: 'EURC', label: 'EURC' },
  ];

  const handleContinue = () => {
    onContinue(fromToken, toToken);
  };

  return (
    <Card variant="elevated" className="max-w-sm mx-auto">
      <CardHeader showBackButton onBackClick={onBack}>
        Swap
      </CardHeader>

      <CardContent>
        {/* From Token Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">From</label>
          <div className="relative">
            <div className="flex items-center gap-3 w-full px-4 py-3 bg-white rounded-2xl border border-green-200">
              {/* Currency icon */}
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">$</span>
              </div>
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-slate-800 font-medium appearance-none cursor-pointer"
              >
                {tokenOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {/* Dropdown arrow */}
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
        </div>

        {/* Swap direction indicator */}
        <div className="flex justify-center py-2">
          <div className="w-8 h-8 bg-white rounded-full border border-green-200 flex items-center justify-center">
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className="text-slate-500"
            >
              <path d="M7 13l3 3 7-7"/>
              <path d="M17 11l3 3-7 7"/>
            </svg>
          </div>
        </div>

        {/* To Token Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">To</label>
          <div className="relative">
            <div className="flex items-center gap-3 w-full px-4 py-3 bg-white rounded-2xl border border-green-200">
              {/* Currency icon */}
              <div className="w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">₮</span>
              </div>
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-slate-800 font-medium appearance-none cursor-pointer"
              >
                {tokenOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {/* Dropdown arrow */}
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
        </div>

        {/* Exchange rate display */}
        <div className="text-center py-2">
          <span className="text-sm text-slate-500">
            1 {fromToken} = 0.99 {toToken}
          </span>
        </div>

        {/* Continue button */}
        <div className="pt-4">
          <Button 
            variant="primary" 
            size="lg" 
            className="w-full"
            onClick={handleContinue}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 