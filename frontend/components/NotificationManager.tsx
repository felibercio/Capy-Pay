import React, { useState, useEffect } from 'react';
import { useMiniKit, useNotification, useAddFrame } from '@worldcoin/minikit-js';
import { Button } from './Button';
import { Card, CardContent } from './Card';

interface NotificationManagerProps {
  userId?: string;
  accessToken?: string;
}

interface NotificationCredentials {
  url: string;
  token: string;
  isFrameAdded: boolean;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({
  userId,
  accessToken
}) => {
  const { isReady, context } = useMiniKit();
  const { sendNotification } = useNotification();
  const { addFrame } = useAddFrame();
  
  const [credentials, setCredentials] = useState<NotificationCredentials | null>(null);
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar se o frame foi adicionado
  const isFrameAdded = context?.client?.added || false;

  // Salvar credenciais de notificação no backend quando frame é adicionado
  const saveNotificationCredentials = async (url: string, token: string) => {
    if (!userId || !accessToken) return;

    try {
      const response = await fetch('/api/notifications/credentials', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          notificationUrl: url,
          notificationToken: token,
          isFrameAdded: true
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao salvar credenciais de notificação');
      }

      console.log('Credenciais de notificação salvas com sucesso');
    } catch (err) {
      console.error('Erro ao salvar credenciais:', err);
    }
  };

  // Buscar credenciais existentes
  useEffect(() => {
    const fetchCredentials = async () => {
      if (!userId || !accessToken || !isReady) return;

      try {
        const response = await fetch('/api/notifications/credentials', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCredentials(data);
        }
      } catch (err) {
        console.error('Erro ao buscar credenciais:', err);
      }
    };

    fetchCredentials();
  }, [userId, accessToken, isReady]);

  // Monitorar mudanças no estado do frame
  useEffect(() => {
    if (isFrameAdded && context?.client?.url && context?.client?.token) {
      const url = context.client.url;
      const token = context.client.token;
      
      // Salvar credenciais no backend
      saveNotificationCredentials(url, token);
      
      // Atualizar estado local
      setCredentials({
        url,
        token,
        isFrameAdded: true
      });
    }
  }, [isFrameAdded, context?.client, userId, accessToken]);

  const handleAddFrame = async () => {
    if (!addFrame) {
      setError('AddFrame não disponível');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await addFrame();
      
      if (result?.url && result?.token) {
        await saveNotificationCredentials(result.url, result.token);
        setCredentials({
          url: result.url,
          token: result.token,
          isFrameAdded: true
        });
      }
    } catch (err) {
      console.error('Erro ao adicionar frame:', err);
      setError('Não foi possível adicionar o frame');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!sendNotification) {
      setError('Notificações não disponíveis');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Enviar notificação via MiniKit
      await sendNotification({
        title: '🐹 Capy Pay Test',
        body: 'Esta é uma notificação de teste do Capy Pay! Você receberá alertas sobre recompensas de referência aqui.',
        icon: '/capy-icon.png',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      });

      setTestNotificationSent(true);
      
      // Também registrar no backend para analytics
      if (userId && accessToken) {
        try {
          await fetch('/api/notifications/test', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              type: 'test_notification',
              timestamp: new Date().toISOString()
            }),
          });
        } catch (backendError) {
          console.error('Erro ao registrar notificação no backend:', backendError);
        }
      }

      // Reset do feedback após 3 segundos
      setTimeout(() => setTestNotificationSent(false), 3000);
      
    } catch (err) {
      console.error('Erro ao enviar notificação:', err);
      setError('Não foi possível enviar a notificação de teste');
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return null;
  }

  return (
    <Card className="max-w-sm mx-auto mb-4">
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h9l-9 9v-9z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-800">Notificações</h3>
        </div>

        {!isFrameAdded ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-yellow-800 font-medium mb-1">Adicione o Capy Pay</p>
                  <p className="text-xs text-yellow-700">
                    Para receber notificações sobre recompensas de referência, adicione o Capy Pay ao seu World App.
                  </p>
                </div>
              </div>
            </div>
            
            <Button
              variant="primary"
              size="md"
              onClick={handleAddFrame}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adicionando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Adicionar Capy Pay
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-green-800 font-medium mb-1">Notificações Ativadas!</p>
                  <p className="text-xs text-green-700">
                    Você receberá alertas sobre recompensas de referência e outras atividades importantes.
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="md"
              onClick={handleSendTestNotification}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-700 mr-2"></div>
                  Enviando...
                </>
              ) : testNotificationSent ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Notificação Enviada!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                  </svg>
                  Enviar Notificação de Teste
                </>
              )}
            </Button>

            {/* Status das credenciais para debug (apenas em desenvolvimento) */}
            {process.env.NODE_ENV === 'development' && credentials && (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Debug Info:</p>
                <p className="text-xs text-slate-500 break-all">
                  URL: {credentials.url.substring(0, 50)}...
                </p>
                <p className="text-xs text-slate-500 break-all">
                  Token: {credentials.token.substring(0, 20)}...
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 rounded-2xl p-4 border border-red-200 mt-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 