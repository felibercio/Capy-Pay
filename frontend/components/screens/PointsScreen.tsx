import React from 'react';
import { Card, CardHeader, CardContent } from '../Card';

interface PointsScreenProps {
  capyPoints: string;
  capyCoins: string;
  onBack: () => void;
}

export const PointsScreen: React.FC<PointsScreenProps> = ({
  capyPoints,
  capyCoins,
  onBack,
}) => {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto">
      <CardHeader 
        showBackButton 
        onBackClick={onBack}
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
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        }
      >
        Points
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