'use client';

import { useState } from 'react';
import { 
  useMiniKit, 
  useAddFrame, 
  useOpenUrl, 
  useViewProfile, 
  useClose,
  usePrimaryButton 
} from '@/lib/minikit-mock';
import { CapyLogo } from '@/components/CapyLogo';
import { 
  ArrowLeftRight, 
  FileText, 
  Users, 
  Gift,
  Menu,
  Copy,
  ArrowLeft,
  DollarSign
} from 'lucide-react';

type ActiveSection = 'home' | 'swap' | 'bills' | 'referral' | 'points' | 'transactions';

export default function Home() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('home');
  const [swapAmount, setSwapAmount] = useState('');
  const [billCode, setBillCode] = useState('');
  
  // Mock data
  const balance = 'R$ 500,00';
  const capyPoints = 2450;
  const capyCoins = 125;
  const referralLink = 'capypay.app/ref/user123';

  const renderHome = () => (
    <div className="capy-card animate-fade-in">
      <div className="flex flex-col items-center mb-8">
        <CapyLogo size="lg" className="mb-4" />
        <h1 className="text-3xl font-bold text-capy-dark">Capy Pay</h1>
      </div>
      
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-capy-dark">{balance}</h2>
      </div>
      
      <div className="space-y-3">
        <button
          onClick={() => setActiveSection('swap')}
          className="capy-button w-full"
        >
          Swap
        </button>
        
        <button
          onClick={() => setActiveSection('bills')}
          className="capy-button-secondary w-full"
        >
          Pay Bill
        </button>
      </div>
      
      <div className="flex justify-around mt-8 pt-6 border-t-2 border-capy-light">
        <button
          onClick={() => setActiveSection('referral')}
          className="capy-nav-item"
        >
          <Users className="w-6 h-6 mb-1" />
          <span className="text-sm">Referral</span>
        </button>
        
        <button
          onClick={() => setActiveSection('transactions')}
          className="capy-nav-item"
        >
          <FileText className="w-6 h-6 mb-1" />
          <span className="text-sm">Transactions</span>
        </button>
        
        <button
          onClick={() => setActiveSection('points')}
          className="capy-nav-item"
        >
          <Gift className="w-6 h-6 mb-1" />
          <span className="text-sm">Points</span>
        </button>
      </div>
    </div>
  );

  const renderSwap = () => (
    <div className="capy-card animate-slide-up">
      <div className="flex items-center mb-6">
        <button
          onClick={() => setActiveSection('home')}
          className="mr-4"
        >
          <ArrowLeft className="w-6 h-6 text-capy-dark" />
        </button>
        <h2 className="text-2xl font-bold text-capy-dark">Swap</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-capy-dark mb-2">
            From
          </label>
          <div className="relative">
            <input
              type="text"
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
              placeholder="0.00"
              className="capy-input pr-20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-capy-dark" />
              <select className="bg-transparent text-capy-dark font-medium focus:outline-none">
                <option>USD</option>
                <option>BRL</option>
                <option>EUR</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center">
          <div className="bg-capy-brown rounded-full p-2">
            <ArrowLeftRight className="w-6 h-6 text-white rotate-90" />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-capy-dark mb-2">
            To
          </label>
          <div className="relative">
            <input
              type="text"
              value={swapAmount ? (parseFloat(swapAmount) * 0.99).toFixed(2) : ''}
              readOnly
              placeholder="0.00"
              className="capy-input pr-20 bg-capy-light"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <div className="w-6 h-6 bg-capy-teal rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">T</span>
              </div>
              <span className="text-capy-dark font-medium">USDC</span>
            </div>
          </div>
        </div>
        
        <div className="text-center text-sm text-gray-600 py-2">
          1 USD = 0.99 USDC
        </div>
        
        <button className="capy-button w-full">
          Continue
        </button>
      </div>
    </div>
  );

  const renderBills = () => (
    <div className="capy-card animate-slide-up">
      <div className="flex items-center mb-6">
        <button
          onClick={() => setActiveSection('home')}
          className="mr-4"
        >
          <ArrowLeft className="w-6 h-6 text-capy-dark" />
        </button>
        <h2 className="text-2xl font-bold text-capy-dark">Pay Bill</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-capy-dark mb-2">
            Balance
          </label>
          <div className="capy-input bg-capy-light text-center text-2xl font-bold">
            0.000
          </div>
        </div>
        
        <div className="py-8">
          <button className="capy-button w-full">
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  const renderReferral = () => (
    <div className="capy-card animate-slide-up">
      <div className="flex items-center mb-6">
        <button
          onClick={() => setActiveSection('home')}
          className="mr-4"
        >
          <ArrowLeft className="w-6 h-6 text-capy-dark" />
        </button>
        <h2 className="text-2xl font-bold text-capy-dark">Referral Link</h2>
      </div>
      
      <div className="space-y-4">
        <p className="text-capy-dark">
          Share the link below with a friend to earn rewards.
        </p>
        
        <div className="bg-capy-light rounded-2xl p-4 flex items-center justify-between">
          <span className="text-capy-dark font-mono text-sm truncate mr-2">
            {referralLink}
          </span>
          <button className="capy-button-secondary py-2 px-4 flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>
      </div>
    </div>
  );

  const renderPoints = () => (
    <div className="capy-card animate-slide-up">
      <div className="flex items-center mb-6">
        <button
          onClick={() => setActiveSection('home')}
          className="mr-4"
        >
          <ArrowLeft className="w-6 h-6 text-capy-dark" />
        </button>
        <h2 className="text-2xl font-bold text-capy-dark">Points</h2>
      </div>
      
      <div className="space-y-4">
        <div className="capy-badge">
          <span>Capy Points</span>
          <span className="font-bold">{capyPoints.toLocaleString()}</span>
        </div>
        
        <div className="capy-badge">
          <span>Capy Coins</span>
          <span className="font-bold">{capyCoins}</span>
        </div>
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="capy-card animate-slide-up">
      <div className="flex items-center mb-6">
        <button
          onClick={() => setActiveSection('home')}
          className="mr-4"
        >
          <ArrowLeft className="w-6 h-6 text-capy-dark" />
        </button>
        <div className="flex-1 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-capy-dark">Transactions</h2>
          <button>
            <Menu className="w-6 h-6 text-capy-dark" />
          </button>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="capy-badge">
          <span>Capy Points</span>
          <span className="font-bold">{capyPoints.toLocaleString()}</span>
        </div>
        
        <div className="capy-badge">
          <span>Capy Coins</span>
          <span className="font-bold">{capyCoins}</span>
        </div>
      </div>
    </div>
  );

  const sections = {
    home: renderHome,
    swap: renderSwap,
    bills: renderBills,
    referral: renderReferral,
    points: renderPoints,
    transactions: renderTransactions,
  };

  return (
    <main className="w-full">
      {sections[activeSection]()}
    </main>
  );
} 