'use client';

import { useState, useEffect } from 'react';
import { 
  useMiniKit, 
  usePrimaryButton, 
  useClose,
  useAddFrame,
  useViewProfile,
  useOpenUrl 
} from '@worldcoin/minikit-js';

// Import all screen components
import { HomeScreen } from '@/components/screens/HomeScreen';
import { SwapScreen } from '@/components/screens/SwapScreen';
import { PayBillScreen } from '@/components/screens/PayBillScreen';
import { TransactionsScreen } from '@/components/screens/TransactionsScreen';
import { ReferralScreen } from '@/components/screens/ReferralScreen';
import { PointsScreen } from '@/components/screens/PointsScreen';
import { NotificationManager } from '@/components/NotificationManager';

type Screen = 'home' | 'swap' | 'payBill' | 'transactions' | 'referral' | 'points';

export default function Home() {
  const { isReady } = useMiniKit();
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  
  // Mock authentication data - in real app, this would come from auth context
  const [authData, setAuthData] = useState({
    userId: 'user_12345',
    accessToken: 'mock_jwt_token_here',
    isAuthenticated: true
  });
  
  // Mock data - in real app, this would come from API/backend
  const [userData, setUserData] = useState({
    balance: '500,00',
    capyPoints: '2.450',
    capyCoins: '125',
    referralLink: 'capypay.app/refe...'
  });

  // MiniKit hooks integration
  const { setPrimaryButton } = usePrimaryButton();
  const { close } = useClose();
  const { addFrame } = useAddFrame();
  const { viewProfile } = useViewProfile();
  const { openUrl } = useOpenUrl();

  // Configure primary button based on current screen
  useEffect(() => {
    if (!isReady) return;

    switch (currentScreen) {
      case 'swap':
        setPrimaryButton({
          text: 'Continue Swap',
          isEnabled: true,
          onClick: () => {
            console.log('Primary button clicked - Continue Swap');
            // Here you would handle the swap logic
            // For now, just go back to home
            setCurrentScreen('home');
          }
        });
        break;
      case 'payBill':
        setPrimaryButton({
          text: 'Continue Payment',
          isEnabled: true,
          onClick: () => {
            console.log('Primary button clicked - Continue Payment');
            // Here you would handle the payment logic
            setCurrentScreen('home');
          }
        });
        break;
      default:
        setPrimaryButton({
          text: '',
          isEnabled: false,
          onClick: () => {}
        });
    }
  }, [currentScreen, isReady, setPrimaryButton]);

  // Screen navigation handlers
  const handleSwapClick = () => {
    setCurrentScreen('swap');
  };

  const handlePayBillClick = () => {
    setCurrentScreen('payBill');
  };

  const handleReferralClick = () => {
    setCurrentScreen('referral');
  };

  const handleTransactionsClick = () => {
    setCurrentScreen('transactions');
  };

  const handlePointsClick = () => {
    setCurrentScreen('points');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
  };

  const handleSwapContinue = (fromToken: string, toToken: string) => {
    console.log(`Swap: ${fromToken} to ${toToken}`);
    // Here you would integrate with your backend API
    // Example: await swapTokens(fromToken, toToken, amount);
    setCurrentScreen('home');
  };

  const handlePayBillContinue = () => {
    console.log('Pay bill continue');
    // Here you would integrate with your backend API
    // Example: await payBill(billData);
    setCurrentScreen('home');
  };

  // Handle MiniKit frame actions
  const handleAddFrame = () => {
    if (addFrame) {
      addFrame();
    }
  };

  const handleViewProfile = () => {
    if (viewProfile) {
      viewProfile();
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-teal-300 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Capy Pay...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-teal-300 p-4">
      {/* Close button for internal screens */}
      {currentScreen !== 'home' && (
        <div className="fixed top-4 right-4 z-10">
          <button
            onClick={() => close?.()}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition-colors"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Profile button (only on home screen) */}
      {currentScreen === 'home' && (
        <div className="fixed top-4 right-4 z-10">
          <button
            onClick={handleViewProfile}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-50 transition-colors"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        </div>
      )}

      {/* Screen routing */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-sm space-y-4">
          {/* Notification Manager - only show on home screen */}
          {currentScreen === 'home' && authData.isAuthenticated && (
            <NotificationManager
              userId={authData.userId}
              accessToken={authData.accessToken}
            />
          )}

          {/* Main screen content */}
          {currentScreen === 'home' && (
            <HomeScreen
              balance={userData.balance}
              onSwapClick={handleSwapClick}
              onPayBillClick={handlePayBillClick}
              onReferralClick={handleReferralClick}
              onTransactionsClick={handleTransactionsClick}
              onPointsClick={handlePointsClick}
            />
          )}

          {currentScreen === 'swap' && (
            <SwapScreen
              onBack={handleBackToHome}
              onContinue={handleSwapContinue}
            />
          )}

          {currentScreen === 'payBill' && (
            <PayBillScreen
              balance={userData.balance}
              onBack={handleBackToHome}
              onContinue={handlePayBillContinue}
            />
          )}

          {currentScreen === 'transactions' && (
            <TransactionsScreen
              capyPoints={userData.capyPoints}
              capyCoins={userData.capyCoins}
            />
          )}

          {currentScreen === 'referral' && (
            <ReferralScreen
              onBack={handleBackToHome}
              userId={authData.userId}
              accessToken={authData.accessToken}
            />
          )}

          {currentScreen === 'points' && (
            <PointsScreen
              capyPoints={userData.capyPoints}
              capyCoins={userData.capyCoins}
              onBack={handleBackToHome}
            />
          )}
        </div>
      </div>
    </div>
  );
} 