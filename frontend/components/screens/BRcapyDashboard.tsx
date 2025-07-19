import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../Card';
import { Button } from '../Button';

interface BRcapyDashboardProps {
  onBack: () => void;
  userId?: string;
  accessToken?: string;
}

interface BRcapyData {
  currentValue: string;
  lastUpdate: string;
  totalSupply: string;
  totalPoolValue: string;
  metrics: {
    apy: string;
    averageDailyYield: string;
    cumulativeYield: string;
    totalUsers: number;
  };
  recentHistory: Array<{
    date: string;
    value: string;
    cdi_rate: string;
    internal_rate: string;
    total_yield: string;
    pool_value: string;
    daily_revenue: string;
  }>;
  poolData: {
    totalLiquidity: string;
    dailyRevenue: string;
    utilizationRate: string;
  };
}

interface UserBRcapyData {
  balance: string;
  valueInBRL: string;
  currentPrice: string;
  lastUpdate: string;
  hasBalance: boolean;
  history: Array<{
    date: string;
    type: string;
    amount: string;
    balance_after: string;
    yield_rate?: string;
    reason?: string;
  }>;
}

export const BRcapyDashboard: React.FC<BRcapyDashboardProps> = ({
  onBack,
  userId,
  accessToken
}) => {
  const [brcapyData, setBRcapyData] = useState<BRcapyData | null>(null);
  const [userBRcapyData, setUserBRcapyData] = useState<UserBRcapyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadBRcapyData();
    if (userId) {
      loadUserBRcapyData();
    }
  }, [userId, accessToken]);

  const loadBRcapyData = async () => {
    try {
      const response = await fetch('/api/brcapy/dashboard', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setBRcapyData(result.data);
      } else {
        setError(result.error || 'Erro ao carregar dados da BRcapy');
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
    }
  };

  const loadUserBRcapyData = async () => {
    try {
      const response = await fetch(`/api/brcapy/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setUserBRcapyData(result.data);
      }
    } catch (err) {
      console.error('Error loading user BRcapy data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(num);
  };

  const formatPercentage = (value: string) => {
    const num = parseFloat(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(4)}%`;
  };

  const getFilteredHistory = () => {
    if (!brcapyData?.recentHistory) return [];

    const days = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };

    return brcapyData.recentHistory.slice(0, days[selectedPeriod]);
  };

  const calculatePeriodReturn = () => {
    const history = getFilteredHistory();
    if (history.length < 2) return '0.00';

    const firstValue = parseFloat(history[history.length - 1].value);
    const lastValue = parseFloat(history[0].value);
    const return_ = ((lastValue - firstValue) / firstValue) * 100;

    return return_.toFixed(4);
  };

  const renderValueChart = () => {
    const history = getFilteredHistory();
    if (history.length === 0) return null;

    const maxValue = Math.max(...history.map(h => parseFloat(h.value)));
    const minValue = Math.min(...history.map(h => parseFloat(h.value)));
    const range = maxValue - minValue;

    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Valorização da BRcapy</h3>
          <div className="flex gap-2">
            {(['7d', '30d', '90d', '1y'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-green-100'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Simplified Chart Visualization */}
        <div className="relative h-32 mb-4">
          <svg width="100%" height="100%" className="overflow-visible">
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.05"/>
              </linearGradient>
            </defs>
            
            {/* Chart Line */}
            {history.length > 1 && (
              <path
                d={history.map((point, index) => {
                  const x = (index / (history.length - 1)) * 100;
                  const normalizedValue = range > 0 ? (parseFloat(point.value) - minValue) / range : 0.5;
                  const y = 100 - (normalizedValue * 80 + 10); // 10% padding top/bottom
                  return `${index === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                }).join(' ')}
                stroke="#10b981"
                strokeWidth="2"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            )}
            
            {/* Fill Area */}
            {history.length > 1 && (
              <path
                d={`${history.map((point, index) => {
                  const x = (index / (history.length - 1)) * 100;
                  const normalizedValue = range > 0 ? (parseFloat(point.value) - minValue) / range : 0.5;
                  const y = 100 - (normalizedValue * 80 + 10);
                  return `${index === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                }).join(' ')} L 100% 100% L 0% 100% Z`}
                fill="url(#chartGradient)"
              />
            )}
          </svg>
        </div>

        {/* Chart Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500 mb-1">Valor Atual</p>
            <p className="font-semibold text-green-600">{formatCurrency(brcapyData?.currentValue || '0')}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Retorno {selectedPeriod}</p>
            <p className={`font-semibold ${parseFloat(calculatePeriodReturn()) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(calculatePeriodReturn())}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">APY</p>
            <p className="font-semibold text-green-600">{formatPercentage(brcapyData?.metrics.apy || '0')}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderUserBalance = () => {
    if (!userBRcapyData) return null;

    return (
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-6 border border-amber-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Meu Saldo BRcapy</h3>
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">🐹</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-600 mb-1">
              {userBRcapyData.balance} BRcapy
            </p>
            <p className="text-lg text-slate-600">
              ≈ {formatCurrency(userBRcapyData.valueInBRL)}
            </p>
          </div>

          {userBRcapyData.hasBalance && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-amber-200">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Preço Atual</p>
                <p className="font-semibold text-slate-700">{formatCurrency(userBRcapyData.currentPrice)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Última Atualização</p>
                <p className="font-semibold text-slate-700">
                  {userBRcapyData.lastUpdate ? 
                    new Date(userBRcapyData.lastUpdate).toLocaleDateString('pt-BR') : 
                    'N/A'
                  }
                </p>
              </div>
            </div>
          )}

          {!userBRcapyData.hasBalance && (
            <div className="text-center py-4">
              <p className="text-slate-500 mb-3">Você ainda não possui BRcapy</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {/* Implementar compra de BRcapy */}}
              >
                Começar a Investir
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMetricsGrid = () => {
    if (!brcapyData) return null;

    const metrics = [
      {
        label: 'Rendimento Médio Diário',
        value: formatPercentage(brcapyData.metrics.averageDailyYield),
        icon: '📈',
        color: 'text-green-600'
      },
      {
        label: 'Rendimento Acumulado',
        value: formatPercentage(brcapyData.metrics.cumulativeYield),
        icon: '💰',
        color: 'text-emerald-600'
      },
      {
        label: 'Pool de Lastro',
        value: formatCurrency(brcapyData.totalPoolValue),
        icon: '🏦',
        color: 'text-blue-600'
      },
      {
        label: 'Total de Investidores',
        value: brcapyData.metrics.totalUsers.toString(),
        icon: '👥',
        color: 'text-purple-600'
      }
    ];

    return (
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{metric.icon}</span>
              <span className="text-xs text-slate-500 font-medium">{metric.label}</span>
            </div>
            <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderRecentActivity = () => {
    if (!userBRcapyData?.history || userBRcapyData.history.length === 0) {
      return (
        <div className="bg-white rounded-2xl p-6 border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Atividade Recente</h3>
          <p className="text-slate-500 text-center py-8">Nenhuma atividade recente</p>
        </div>
      );
    }

    const getActivityIcon = (type: string) => {
      switch (type) {
        case 'daily_yield': return '💰';
        case 'distribution': return '🎁';
        case 'redemption': return '💸';
        default: return '📊';
      }
    };

    const getActivityLabel = (type: string) => {
      switch (type) {
        case 'daily_yield': return 'Rendimento Diário';
        case 'distribution': return 'Distribuição';
        case 'redemption': return 'Resgate';
        default: return 'Atividade';
      }
    };

    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Atividade Recente</h3>
        <div className="space-y-3">
          {userBRcapyData.history.slice(0, 5).map((activity, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">{getActivityIcon(activity.type)}</span>
                </div>
                <div>
                  <p className="font-medium text-slate-800">{getActivityLabel(activity.type)}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(activity.date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${
                  parseFloat(activity.amount) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {parseFloat(activity.amount) >= 0 ? '+' : ''}{parseFloat(activity.amount).toFixed(8)} BRcapy
                </p>
                {activity.yield_rate && (
                  <p className="text-xs text-slate-500">{activity.yield_rate}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBRcapyInfo = () => {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">ℹ️</span>
          </div>
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">O que é a BRcapy?</h3>
            <div className="text-sm text-blue-700 space-y-2">
              <p>
                A BRcapy é a yieldcoin do Capy Pay que oferece rendimento real baseado em:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>CDI (Certificado de Depósito Interbancário)</strong> - Taxa de referência do mercado brasileiro</li>
                <li><strong>Taxas Internas</strong> - Revenue gerado pelo uso do app (swaps, pagamentos, etc.)</li>
                <li><strong>Pool de Lastro</strong> - Reservas em stablecoins que garantem a liquidez</li>
              </ul>
              <p className="mt-3">
                <strong>Fórmula de Valorização:</strong><br/>
                Valor_Novo = Valor_Anterior × (1 + CDI_Diário + Taxas_Internas_Diárias)
              </p>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-4 py-2 text-blue-600 font-medium text-sm hover:bg-blue-100 rounded-lg transition-colors"
        >
          {showDetails ? 'Ocultar Detalhes' : 'Ver Mais Detalhes'}
        </button>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-blue-200 text-sm text-blue-700 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium">Supply Total:</p>
                <p>{brcapyData?.totalSupply || '0'} BRcapy</p>
              </div>
              <div>
                <p className="font-medium">Liquidez da Pool:</p>
                <p>{formatCurrency(brcapyData?.poolData.totalLiquidity || '0')}</p>
              </div>
              <div>
                <p className="font-medium">Revenue Diário:</p>
                <p>{formatCurrency(brcapyData?.poolData.dailyRevenue || '0')}</p>
              </div>
              <div>
                <p className="font-medium">Taxa de Utilização:</p>
                <p>{brcapyData?.poolData.utilizationRate || '0%'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card variant="elevated" className="max-w-4xl mx-auto">
        <CardHeader showBackButton onBackClick={onBack}>
          BRcapy Dashboard
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="elevated" className="max-w-4xl mx-auto">
        <CardHeader showBackButton onBackClick={onBack}>
          BRcapy Dashboard
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-red-800 font-medium">Erro ao carregar dados</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    loadBRcapyData();
                    if (userId) loadUserBRcapyData();
                  }}
                  className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="max-w-4xl mx-auto">
      <CardHeader showBackButton onBackClick={onBack}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐹</span>
          BRcapy Dashboard
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {/* Value Chart */}
          {renderValueChart()}

          {/* User Balance */}
          {renderUserBalance()}

          {/* Metrics Grid */}
          {renderMetricsGrid()}

          {/* Recent Activity */}
          {renderRecentActivity()}

          {/* BRcapy Info */}
          {renderBRcapyInfo()}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {/* Implementar compra */}}
              disabled={!userId}
            >
              <span className="flex items-center gap-2">
                <span>💰</span>
                Investir em BRcapy
              </span>
            </Button>
            
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {/* Implementar resgate */}}
              disabled={!userId || !userBRcapyData?.hasBalance}
            >
              <span className="flex items-center gap-2">
                <span>💸</span>
                Resgatar BRcapy
              </span>
            </Button>
          </div>

          {/* Disclaimer */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="text-xs text-slate-600 text-center">
              <strong>Aviso:</strong> A BRcapy é um produto de investimento que envolve riscos. 
              O rendimento passado não garante resultados futuros. A valorização está sujeita 
              às variações do CDI e do desempenho do app. Leia os termos de uso antes de investir.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 