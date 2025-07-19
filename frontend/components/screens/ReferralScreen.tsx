import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../Card';
import { Button } from '../Button';

interface ReferralScreenProps {
  onBack: () => void;
  userId?: string;
  accessToken?: string;
}

interface ReferralData {
  referralLink: string;
  referralCode: string;
  totalReferred: number;
  totalRewardsEarned: string;
  recentReferrals: Array<{
    userName: string;
    rewardEarned: string;
    date: string;
  }>;
}

export const ReferralScreen: React.FC<ReferralScreenProps> = ({
  onBack,
  userId,
  accessToken
}) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralData, setReferralData] = useState<ReferralData>({
    referralLink: '',
    referralCode: '',
    totalReferred: 0,
    totalRewardsEarned: '0',
    recentReferrals: []
  });

  // Buscar dados de referência do backend
  useEffect(() => {
    const fetchReferralData = async () => {
      if (!userId || !accessToken) {
        setError('Usuário não autenticado');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/referral/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar dados de referência');
        }

        const data = await response.json();
        setReferralData(data);
      } catch (err) {
        console.error('Erro ao buscar dados de referência:', err);
        setError('Não foi possível carregar os dados de referência');
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, [userId, accessToken]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralData.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
      // Fallback para navegadores que não suportam clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = referralData.referralLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Capy Pay - Pagamentos Crypto Simples',
          text: 'Junte-se a mim no Capy Pay e ganhe recompensas em crypto!',
          url: referralData.referralLink,
        });
      } catch (err) {
        console.error('Erro ao compartilhar:', err);
      }
    } else {
      // Fallback para cópia
      handleCopy();
    }
  };

  if (loading) {
    return (
      <Card variant="elevated" className="max-w-sm mx-auto">
        <CardHeader showBackButton onBackClick={onBack}>
          Referral Link
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700"></div>
            <span className="ml-3 text-slate-600">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="elevated" className="max-w-sm mx-auto">
        <CardHeader showBackButton onBackClick={onBack}>
          Referral Link
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="max-w-sm mx-auto">
      <CardHeader showBackButton onBackClick={onBack}>
        Programa de Referência
      </CardHeader>

      <CardContent>
        {/* Estatísticas de referência */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-green-200 text-center">
            <div className="text-2xl font-bold text-amber-700">{referralData.totalReferred}</div>
            <div className="text-sm text-slate-600">Amigos Indicados</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-green-200 text-center">
            <div className="text-2xl font-bold text-green-600">{referralData.totalRewardsEarned}</div>
            <div className="text-sm text-slate-600">Capy Coins Ganhos</div>
          </div>
        </div>

        {/* Descrição do programa */}
        <div className="bg-amber-50 rounded-2xl p-4 mb-6 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 mb-1">Como Funciona</h3>
              <p className="text-sm text-amber-700">
                Compartilhe seu link e ganhe <strong>10% das taxas</strong> de todas as transações dos seus indicados em Capy Coins!
              </p>
            </div>
          </div>
        </div>

        {/* Link de referência */}
        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium text-slate-700">Seu Link de Referência</label>
          <div className="bg-white rounded-2xl border border-green-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 text-slate-800 font-medium text-sm break-all">
                {referralData.referralLink}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopy}
                className="flex-1"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShare}
                className="flex-1"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Compartilhar
              </Button>
            </div>
          </div>
        </div>

        {/* Referências recentes */}
        {referralData.recentReferrals.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Indicações Recentes</label>
            <div className="space-y-2">
              {referralData.recentReferrals.map((referral, index) => (
                <div key={index} className="bg-white rounded-2xl p-3 border border-green-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-slate-800">{referral.userName}</div>
                      <div className="text-xs text-slate-500">{referral.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">+{referral.rewardEarned}</div>
                      <div className="text-xs text-slate-500">Capy Coins</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mensagem motivacional se não há referências */}
        {referralData.recentReferrals.length === 0 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Comece a Indicar!</h3>
            <p className="text-sm text-slate-600">
              Compartilhe seu link com amigos e comece a ganhar recompensas em Capy Coins.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 