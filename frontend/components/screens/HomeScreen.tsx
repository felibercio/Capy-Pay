import React from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { CapyLogoSVG } from '../CapyLogo';
import { BalanceDisplay } from '../InputField';

interface HomeScreenProps {
  balance: string;
  onSwapClick: () => void;
  onPayBillClick: () => void;
  onReferralClick: () => void;
  onTransactionsClick: () => void;
  onPointsClick: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  balance,
  onSwapClick,
  onPayBillClick,
  onReferralClick,
  onTransactionsClick,
  onPointsClick,
}) => {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto">
      {/* Header with logo and app name */}
      <div className="flex items-center gap-3 mb-6">
        <CapyLogoSVG size="md" />
        <h1 className="text-2xl font-bold text-slate-800">Capy Pay</h1>
      </div>

      {/* Balance display */}
      <div className="mb-8">
        <BalanceDisplay 
          amount={balance}
          currency="R"
          variant="large"
          className="text-center"
        />
      </div>

      {/* Main action buttons */}
      <div className="space-y-4 mb-8">
        <Button 
          variant="primary" 
          size="lg" 
          className="w-full"
          onClick={onSwapClick}
        >
          Swap
        </Button>
        
        <Button 
          variant="secondary" 
          size="lg" 
          className="w-full"
          onClick={onPayBillClick}
        >
          Pay Bill
        </Button>
      </div>

      {/* Bottom navigation */}
      <div className="bg-white rounded-2xl p-4 border border-green-200">
        <div className="flex justify-around">
          <button
            onClick={onReferralClick}
            className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-green-50 transition-colors"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className="text-slate-600"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <span className="text-sm text-slate-600 font-medium">Referral</span>
          </button>

          <button
            onClick={onTransactionsClick}
            className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-green-50 transition-colors"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className="text-slate-600"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
            </div>
            <span className="text-sm text-slate-600 font-medium">Transactions</span>
          </button>

          <button
            onClick={onPointsClick}
            className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-green-50 transition-colors"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className="text-slate-600"
              >
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
              </svg>
            </div>
            <span className="text-sm text-slate-600 font-medium">Points</span>
          </button>
        </div>
      </div>
    </Card>
  );
}; 