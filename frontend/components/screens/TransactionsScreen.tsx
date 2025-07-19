import React from 'react';
import { Card, CardHeader, CardContent } from '../Card';

interface TransactionsScreenProps {
  capyPoints: string;
  capyCoins: string;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  capyPoints,
  capyCoins,
}) => {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto">
      <CardHeader 
        rightElement={
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-100 transition-colors">
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className="text-slate-600"
            >
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        }
      >
        Transactions
      </CardHeader>

      <CardContent>
        {/* Capy Points Balance */}
        <div className="bg-white rounded-2xl p-4 border border-green-200 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-slate-700 font-medium">Capy Points</span>
            <span className="text-xl font-semibold text-slate-800">{capyPoints}</span>
          </div>
        </div>

        {/* Capy Coins Balance */}
        <div className="bg-white rounded-2xl p-4 border border-green-200">
          <div className="flex justify-between items-center">
            <span className="text-slate-700 font-medium">Capy Coins</span>
            <span className="text-xl font-semibold text-slate-800">{capyCoins}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 