const { ethers } = require('ethers');
const logger = require('../utils/logger');
const SwapService = require('./SwapService');
const StarkBankService = require('./StarkBankService');

class BlockchainMonitorService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.isMonitoring = false;
    this.swapService = new SwapService();
    this.starkBankService = new StarkBankService();
    
    // Configurações
    this.config = {
      rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      privateKey: process.env.BASE_PRIVATE_KEY,
      walletAddress: process.env.BASE_WALLET_ADDRESS,
      depositWalletAddress: process.env.DEPOSIT_WALLET_ADDRESS,
      confirmationCount: parseInt(process.env.BLOCK_CONFIRMATION_COUNT) || 3,
      monitoringInterval: parseInt(process.env.MONITORING_INTERVAL_MS) || 5000,
    };

    // Contratos de tokens
    this.tokens = {
      USDC: {
        address: process.env.USDC_BASE_CONTRACT || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        symbol: 'USDC',
      },
      BRZ: {
        address: process.env.BRZ_BASE_CONTRACT || '0x420000000000000000000000000000000000000A',
        decimals: 4,
        symbol: 'BRZ',
      },
      EURC: {
        address: process.env.EURC_BASE_CONTRACT || '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
        decimals: 6,
        symbol: 'EURC',
      },
    };

    // ERC20 ABI para eventos Transfer
    this.erc20Abi = [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ];

    this.initializeProvider();
  }

  /**
   * Inicializa conexão com o provider
   */
  async initializeProvider() {
    try {
      // Tentar múltiplos providers para redundância
      const providers = await this.createProviders();
      
      for (const provider of providers) {
        try {
          await provider.getNetwork();
          this.provider = provider;
          logger.info('Blockchain provider initialized successfully', {
            provider: provider.connection?.url || 'unknown',
          });
          break;
        } catch (error) {
          logger.warn('Provider failed, trying next', { error: error.message });
          continue;
        }
      }

      if (!this.provider) {
        throw new Error('No working provider found');
      }

      // Inicializar wallet se chave privada fornecida
      if (this.config.privateKey) {
        this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
        logger.info('Wallet initialized', {
          address: this.wallet.address,
        });
      }

      // Verificar rede
      const network = await this.provider.getNetwork();
      logger.info('Connected to network', {
        chainId: network.chainId,
        name: network.name,
      });

    } catch (error) {
      logger.error('Failed to initialize blockchain provider', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Cria lista de providers para redundância
   */
  async createProviders() {
    const providers = [];

    // Alchemy
    if (process.env.ALCHEMY_API_KEY) {
      providers.push(
        new ethers.AlchemyProvider('base', process.env.ALCHEMY_API_KEY)
      );
    }

    // Infura
    if (process.env.INFURA_API_KEY) {
      providers.push(
        new ethers.InfuraProvider('base', process.env.INFURA_API_KEY)
      );
    }

    // QuickNode
    if (process.env.QUICKNODE_URL) {
      providers.push(
        new ethers.JsonRpcProvider(process.env.QUICKNODE_URL)
      );
    }

    // Provider padrão
    providers.push(
      new ethers.JsonRpcProvider(this.config.rpcUrl)
    );

    return providers;
  }

  /**
   * Inicia monitoramento de depósitos
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Monitoring already active');
      return;
    }

    try {
      this.isMonitoring = true;
      logger.info('Starting blockchain monitoring', {
        depositWallet: this.config.depositWalletAddress,
        tokens: Object.keys(this.tokens),
      });

      // Monitorar cada token
      for (const [symbol, tokenInfo] of Object.entries(this.tokens)) {
        await this.setupTokenListener(symbol, tokenInfo);
      }

      // Monitorar blocos para confirmações
      this.provider.on('block', (blockNumber) => {
        logger.debug('New block detected', { blockNumber });
      });

      logger.info('Blockchain monitoring started successfully');
    } catch (error) {
      logger.error('Failed to start monitoring', {
        error: error.message,
        stack: error.stack,
      });
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Para monitoramento
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    try {
      this.isMonitoring = false;
      
      // Remover todos os listeners
      this.provider.removeAllListeners();
      
      logger.info('Blockchain monitoring stopped');
    } catch (error) {
      logger.error('Error stopping monitoring', {
        error: error.message,
      });
    }
  }

  /**
   * Configura listener para um token específico
   */
  async setupTokenListener(symbol, tokenInfo) {
    try {
      const contract = new ethers.Contract(
        tokenInfo.address,
        this.erc20Abi,
        this.provider
      );

      // Filtro para transferências para nossa wallet de depósito
      const filter = contract.filters.Transfer(
        null, // qualquer remetente
        this.config.depositWalletAddress // para nossa wallet
      );

      logger.info('Setting up token listener', {
        symbol,
        contract: tokenInfo.address,
        depositWallet: this.config.depositWalletAddress,
      });

      // Listener para novos depósitos
      contract.on(filter, async (from, to, amount, event) => {
        try {
          await this.handleDepositEvent(symbol, tokenInfo, {
            from,
            to,
            amount,
            event,
          });
        } catch (error) {
          logger.error('Error handling deposit event', {
            error: error.message,
            symbol,
            from,
            to,
            amount: amount.toString(),
          });
        }
      });

      // Listener para logs históricos (últimos 100 blocos)
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100);
      
      const historicalLogs = await contract.queryFilter(
        filter,
        fromBlock,
        currentBlock
      );

      logger.info('Historical deposits found', {
        symbol,
        count: historicalLogs.length,
        fromBlock,
        currentBlock,
      });

      // Processar logs históricos
      for (const log of historicalLogs) {
        try {
          await this.handleDepositEvent(symbol, tokenInfo, {
            from: log.args.from,
            to: log.args.to,
            amount: log.args.value,
            event: log,
          });
        } catch (error) {
          logger.error('Error processing historical deposit', {
            error: error.message,
            txHash: log.transactionHash,
          });
        }
      }

    } catch (error) {
      logger.error('Failed to setup token listener', {
        error: error.message,
        symbol,
        tokenAddress: tokenInfo.address,
      });
      throw error;
    }
  }

  /**
   * Processa evento de depósito
   */
  async handleDepositEvent(symbol, tokenInfo, eventData) {
    const { from, to, amount, event } = eventData;

    try {
      // Aguardar confirmações
      const receipt = await this.waitForConfirmations(
        event.transactionHash,
        this.config.confirmationCount
      );

      if (!receipt || receipt.status !== 1) {
        logger.warn('Transaction failed or not confirmed', {
          txHash: event.transactionHash,
          status: receipt?.status,
        });
        return;
      }

      // Converter amount para formato legível
      const formattedAmount = ethers.formatUnits(amount, tokenInfo.decimals);
      
      logger.info('Deposit detected and confirmed', {
        symbol,
        from,
        to,
        amount: formattedAmount,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });

      // Criar registro de depósito
      const depositData = {
        id: `deposit_${event.transactionHash}`,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        from,
        to,
        token: symbol,
        tokenAddress: tokenInfo.address,
        amount: formattedAmount,
        amountWei: amount.toString(),
        timestamp: new Date(),
        status: 'confirmed',
        type: 'deposit',
      };

      // Salvar depósito
      await this.saveDeposit(depositData);

      // Notificar sobre o depósito
      await this.notifyDeposit(depositData);

      // Processar swap se necessário
      await this.processDepositSwap(depositData);

    } catch (error) {
      logger.error('Error handling deposit event', {
        error: error.message,
        stack: error.stack,
        txHash: event.transactionHash,
      });
    }
  }

  /**
   * Aguarda confirmações de transação
   */
  async waitForConfirmations(txHash, confirmations = 3) {
    try {
      logger.info('Waiting for confirmations', {
        txHash,
        confirmations,
      });

      const receipt = await this.provider.waitForTransaction(
        txHash,
        confirmations,
        60000 // timeout 60s
      );

      return receipt;
    } catch (error) {
      logger.error('Error waiting for confirmations', {
        error: error.message,
        txHash,
      });
      return null;
    }
  }

  /**
   * Processa swap após depósito
   */
  async processDepositSwap(depositData) {
    try {
      // Lógica de swap baseada no token depositado
      let swapParams = null;

      switch (depositData.token) {
        case 'USDC':
          // Se recebeu USDC, pode precisar converter para BRZ para pagamentos BR
          swapParams = {
            fromToken: 'USDC',
            toToken: 'BRZ',
            amount: depositData.amount,
            reason: 'deposit_conversion',
          };
          break;

        case 'BRZ':
          // BRZ já está pronto para pagamentos BR
          logger.info('BRZ deposit ready for payments', {
            amount: depositData.amount,
            depositId: depositData.id,
          });
          break;

        case 'EURC':
          // EURC pode ser convertido para USDC ou BRZ
          swapParams = {
            fromToken: 'EURC',
            toToken: 'USDC',
            amount: depositData.amount,
            reason: 'deposit_conversion',
          };
          break;
      }

      if (swapParams) {
        logger.info('Initiating deposit swap', {
          depositId: depositData.id,
          swapParams,
        });

        const swapResult = await this.swapService.executeSwap(
          swapParams.fromToken,
          swapParams.toToken,
          swapParams.amount,
          this.config.privateKey,
          {
            depositId: depositData.id,
            reason: swapParams.reason,
          }
        );

        if (swapResult.success) {
          logger.info('Deposit swap completed successfully', {
            depositId: depositData.id,
            swapTxHash: swapResult.txHash,
          });

          // Atualizar registro de depósito
          await this.updateDeposit(depositData.id, {
            swapTxHash: swapResult.txHash,
            swapStatus: 'completed',
            finalToken: swapParams.toToken,
            finalAmount: swapResult.outputAmount,
          });
        }
      }

    } catch (error) {
      logger.error('Error processing deposit swap', {
        error: error.message,
        depositId: depositData.id,
      });
    }
  }

  /**
   * Notifica sobre depósito
   */
  async notifyDeposit(depositData) {
    try {
      // Notificar StarkBankService se necessário
      if (depositData.token === 'BRZ' || depositData.finalToken === 'BRZ') {
        // Depósito em BRZ pode ser usado para pagamentos
        logger.info('Notifying payment service about BRZ deposit', {
          depositId: depositData.id,
          amount: depositData.amount,
        });

        // TODO: Implementar notificação para StarkBankService
        // await this.starkBankService.notifyDepositReceived(depositData);
      }

      // TODO: Notificar frontend via WebSocket
      // await this.notifyFrontend('deposit_received', depositData);

    } catch (error) {
      logger.error('Error notifying about deposit', {
        error: error.message,
        depositId: depositData.id,
      });
    }
  }

  /**
   * Salva depósito no banco (placeholder)
   */
  async saveDeposit(depositData) {
    // TODO: Implementar persistência real
    logger.info('Saving deposit (placeholder)', {
      id: depositData.id,
      token: depositData.token,
      amount: depositData.amount,
    });

    // Placeholder em memória
    if (!global.deposits) {
      global.deposits = new Map();
    }
    global.deposits.set(depositData.id, depositData);
  }

  /**
   * Atualiza depósito no banco (placeholder)
   */
  async updateDeposit(depositId, updates) {
    // TODO: Implementar atualização real
    logger.info('Updating deposit (placeholder)', {
      depositId,
      updates,
    });

    if (global.deposits && global.deposits.has(depositId)) {
      const existing = global.deposits.get(depositId);
      global.deposits.set(depositId, { ...existing, ...updates });
    }
  }

  /**
   * Obtém saldo de token
   */
  async getTokenBalance(tokenSymbol, walletAddress = null) {
    try {
      const address = walletAddress || this.config.walletAddress;
      const tokenInfo = this.tokens[tokenSymbol];

      if (!tokenInfo) {
        throw new Error(`Token ${tokenSymbol} not supported`);
      }

      const contract = new ethers.Contract(
        tokenInfo.address,
        this.erc20Abi,
        this.provider
      );

      const balance = await contract.balanceOf(address);
      const formattedBalance = ethers.formatUnits(balance, tokenInfo.decimals);

      return {
        symbol: tokenSymbol,
        balance: formattedBalance,
        balanceWei: balance.toString(),
        address: tokenInfo.address,
      };
    } catch (error) {
      logger.error('Error getting token balance', {
        error: error.message,
        tokenSymbol,
        walletAddress,
      });
      throw error;
    }
  }

  /**
   * Obtém todos os saldos
   */
  async getAllBalances(walletAddress = null) {
    try {
      const balances = {};

      for (const symbol of Object.keys(this.tokens)) {
        balances[symbol] = await this.getTokenBalance(symbol, walletAddress);
      }

      return balances;
    } catch (error) {
      logger.error('Error getting all balances', {
        error: error.message,
        walletAddress,
      });
      throw error;
    }
  }

  /**
   * Obtém histórico de depósitos
   */
  getDepositHistory(limit = 50) {
    // TODO: Implementar busca real no banco
    if (!global.deposits) {
      return [];
    }

    return Array.from(global.deposits.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Verifica status do serviço
   */
  async getServiceStatus() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const balances = await this.getAllBalances();

      return {
        isMonitoring: this.isMonitoring,
        network: {
          chainId: network.chainId,
          name: network.name,
        },
        currentBlock: blockNumber,
        walletAddress: this.config.walletAddress,
        balances,
        tokens: this.tokens,
      };
    } catch (error) {
      logger.error('Error getting service status', {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = BlockchainMonitorService; 