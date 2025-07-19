import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../Card';
import { Button } from '../Button';
import { BalanceDisplay } from '../InputField';

interface PayBillScreenProps {
  balance: string;
  onBack: () => void;
  onContinue: () => void;
}

export const PayBillScreen: React.FC<PayBillScreenProps> = ({
  balance,
  onBack,
  onContinue,
}) => {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto">
      <CardHeader showBackButton onBackClick={onBack}>
        Pay Bill
      </CardHeader>

      <CardContent>
        {/* Balance section */}
        <div className="space-y-2 mb-8">
          <label className="text-sm font-medium text-slate-700">Balance</label>
          <BalanceDisplay 
            amount={balance}
            variant="medium"
          />
        </div>

        {/* Continue button */}
        <Button 
          variant="primary" 
          size="lg" 
          className="w-full"
          onClick={onContinue}
        >
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}; 