#!/usr/bin/env node

/**
 * Script de inicialização dos serviços blockchain
 * Executa verificações e inicia monitoramento automaticamente
 */

const logger = require('../utils/logger');
const BlockchainMonitorService = require('../services/BlockchainMonitorService');
const SwapService = require('../services/SwapService');
const IntegrationService = require('../services/IntegrationService');

class ServiceInitializer {
  constructor() {
    this.services = {
      blockchain: new BlockchainMonitorService(),
      swap: new SwapService(),
      integration: new IntegrationService(),
    };
    
    this.isInitialized = false;
  }

  /**
   * Executa inicialização completa dos serviços
   */
  async initialize() {
    try {
      logger.info('🚀 Starting Capy Pay blockchain services initialization');

      // 1. Verificar configuração
      await this.checkConfiguration();

      // 2. Verificar conectividade
      await this.checkConnectivity();

      // 3. Verificar saldos
      await this.checkBalances();

      // 4. Inicializar serviços
      await this.initializeServices();

      // 5. Configurar monitoring
      await this.setupMonitoring();

      this.isInitialized = true;
      logger.info('✅ All blockchain services initialized successfully');

      return {
        success: true,
        message: 'Services initialized successfully',
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('❌ Failed to initialize blockchain services', {
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Verifica configuração essencial
   */
  async checkConfiguration() {
    logger.info('🔧 Checking configuration...');

    const requiredEnvVars = [
      'BASE_RPC_URL',
      'BASE_WALLET_ADDRESS',
      'DEPOSIT_WALLET_ADDRESS',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Verificar se pelo menos um provider está configurado
    const hasProvider = !!(
      process.env.ALCHEMY_API_KEY ||
      process.env.INFURA_API_KEY ||
      process.env.QUICKNODE_URL
    );

    if (!hasProvider) {
      logger.warn('⚠️  No external providers configured, using default RPC');
    }

    // Verificar 1inch API key
    if (!process.env.ONEINCH_API_KEY) {
      logger.warn('⚠️  1inch API key not configured, using simulated quotes');
    }

    logger.info('✅ Configuration check passed');
  }

  /**
   * Verifica conectividade com blockchain
   */
  async checkConnectivity() {
    logger.info('🌐 Checking blockchain connectivity...');

    try {
      const status = await this.services.blockchain.getServiceStatus();
      
      if (!status.network) {
        throw new Error('Cannot connect to blockchain network');
      }

      logger.info('✅ Blockchain connectivity verified', {
        chainId: status.network.chainId,
        currentBlock: status.currentBlock,
      });

    } catch (error) {
      logger.error('❌ Blockchain connectivity check failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verifica saldos de tokens
   */
  async checkBalances() {
    logger.info('💰 Checking token balances...');

    try {
      const balances = await this.services.blockchain.getAllBalances();
      
      logger.info('Token balances:', balances);

      // Verificar se há saldo suficiente para operações
      const totalValue = Object.values(balances).reduce((sum, token) => {
        return sum + parseFloat(token.balance);
      }, 0);

      if (totalValue === 0) {
        logger.warn('⚠️  No token balances found - ensure wallet is funded');
      }

      logger.info('✅ Balance check completed');

    } catch (error) {
      logger.error('❌ Balance check failed', {
        error: error.message,
      });
      // Não falhar inicialização por falta de saldo
    }
  }

  /**
   * Inicializa serviços individuais
   */
  async initializeServices() {
    logger.info('🔄 Initializing individual services...');

    // Inicializar serviço de swap
    try {
      const swapStatus = await this.services.swap.getServiceStatus();
      logger.info('✅ Swap service initialized', {
        apiStatus: swapStatus.apiStatus,
        supportedTokens: swapStatus.supportedTokens,
      });
    } catch (error) {
      logger.error('❌ Swap service initialization failed', {
        error: error.message,
      });
      throw error;
    }

    // Inicializar serviço de integração
    try {
      await this.services.integration.initialize();
      logger.info('✅ Integration service initialized');
    } catch (error) {
      logger.error('❌ Integration service initialization failed', {
        error: error.message,
      });
      throw error;
    }

    logger.info('✅ All services initialized successfully');
  }

  /**
   * Configura monitoramento automático
   */
  async setupMonitoring() {
    logger.info('📊 Setting up monitoring...');

    try {
      // Iniciar monitoramento de depósitos
      await this.services.blockchain.startMonitoring();
      logger.info('✅ Deposit monitoring started');

      // Configurar health checks periódicos
      this.setupHealthChecks();
      logger.info('✅ Health checks configured');

      // Configurar alertas
      this.setupAlerts();
      logger.info('✅ Alerts configured');

    } catch (error) {
      logger.error('❌ Monitoring setup failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Configura health checks periódicos
   */
  setupHealthChecks() {
    const healthCheckInterval = 5 * 60 * 1000; // 5 minutos

    setInterval(async () => {
      try {
        const [blockchainStatus, swapStatus] = await Promise.all([
          this.services.blockchain.getServiceStatus(),
          this.services.swap.getServiceStatus(),
        ]);

        logger.debug('Health check completed', {
          blockchain: {
            isMonitoring: blockchainStatus.isMonitoring,
            currentBlock: blockchainStatus.currentBlock,
          },
          swap: {
            apiStatus: swapStatus.apiStatus,
          },
        });

        // Verificar se serviços estão saudáveis
        if (!blockchainStatus.isMonitoring) {
          logger.warn('⚠️  Blockchain monitoring is not active');
        }

        if (swapStatus.apiStatus === 'down') {
          logger.warn('⚠️  Swap service API is down');
        }

      } catch (error) {
        logger.error('❌ Health check failed', {
          error: error.message,
        });
      }
    }, healthCheckInterval);

    logger.info('Health checks scheduled every 5 minutes');
  }

  /**
   * Configura alertas para eventos importantes
   */
  setupAlerts() {
    // Alerta para saldo baixo
    const lowBalanceThreshold = 10; // $10 equivalent

    setInterval(async () => {
      try {
        const balances = await this.services.blockchain.getAllBalances();
        
        for (const [symbol, balance] of Object.entries(balances)) {
          const balanceValue = parseFloat(balance.balance);
          
          if (balanceValue < lowBalanceThreshold) {
            logger.warn('🚨 Low balance alert', {
              token: symbol,
              balance: balanceValue,
              threshold: lowBalanceThreshold,
            });
          }
        }

      } catch (error) {
        logger.error('Error checking balance alerts', {
          error: error.message,
        });
      }
    }, 10 * 60 * 1000); // 10 minutos

    logger.info('Low balance alerts configured');
  }

  /**
   * Executa shutdown graceful
   */
  async shutdown() {
    logger.info('🛑 Shutting down blockchain services...');

    try {
      // Parar monitoramento
      await this.services.blockchain.stopMonitoring();
      logger.info('✅ Blockchain monitoring stopped');

      // Limpar intervals
      // TODO: Implementar cleanup de intervals

      logger.info('✅ Blockchain services shutdown completed');

    } catch (error) {
      logger.error('❌ Error during shutdown', {
        error: error.message,
      });
    }
  }

  /**
   * Obtém status geral dos serviços
   */
  async getOverallStatus() {
    try {
      const [blockchainStatus, swapStatus, integrationStatus] = await Promise.all([
        this.services.blockchain.getServiceStatus(),
        this.services.swap.getServiceStatus(),
        this.services.integration.getIntegrationStatus(),
      ]);

      return {
        isInitialized: this.isInitialized,
        services: {
          blockchain: blockchainStatus,
          swap: swapStatus,
          integration: integrationStatus,
        },
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Error getting overall status', {
        error: error.message,
      });
      throw error;
    }
  }
}

// Exportar classe para uso em outros módulos
module.exports = ServiceInitializer;

// Executar inicialização se script for chamado diretamente
if (require.main === module) {
  const initializer = new ServiceInitializer();
  
  initializer.initialize()
    .then(result => {
      if (result.success) {
        logger.info('🎉 Blockchain services are ready!');
        
        // Manter processo vivo
        process.on('SIGINT', async () => {
          logger.info('Received SIGINT, shutting down...');
          await initializer.shutdown();
          process.exit(0);
        });

        process.on('SIGTERM', async () => {
          logger.info('Received SIGTERM, shutting down...');
          await initializer.shutdown();
          process.exit(0);
        });

      } else {
        logger.error('Failed to initialize services');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Initialization failed', { error: error.message });
      process.exit(1);
    });
} 