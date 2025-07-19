const { ethers } = require('ethers');
const axios = require('axios');
const BigNumber = require('bignumber.js');
const logger = require('../utils/logger');

class SwapService {
  constructor() {
    // Configurações 1inch
    this.config = {
      apiKey: process.env.ONEINCH_API_KEY,
      baseUrl: process.env.ONEINCH_BASE_URL || 'https://api.1inch.dev/swap/v6.0/8453',
      chainId: 8453, // Base network
      slippage: 1, // 1% slippage padrão
    };

    // Contratos de tokens na Base
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

    // ERC20 ABI
    this.erc20Abi = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function balanceOf(address owner) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
    ];

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Executa swap entre tokens
   * @param {string} fromTokenSymbol - Token de origem (USDC, BRZ, EURC)
   * @param {string} toTokenSymbol - Token de destino
   * @param {string|number} amount - Quantidade a ser trocada
   * @param {string} privateKey - Chave privada da wallet
   * @param {Object} metadata - Metadados adicionais
   * @returns {Promise<Object>} Resultado do swap
   */
  async executeSwap(fromTokenSymbol, toTokenSymbol, amount, privateKey, metadata = {}) {
    try {
      logger.info('Starting swap execution', {
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        amount,
        metadata,
      });

      // Validar tokens
      const fromToken = this.tokens[fromTokenSymbol];
      const toToken = this.tokens[toTokenSymbol];

      if (!fromToken || !toToken) {
        throw new Error(`Unsupported token pair: ${fromTokenSymbol} -> ${toTokenSymbol}`);
      }

      // Converter amount para wei
      const amountWei = ethers.parseUnits(amount.toString(), fromToken.decimals);

      // Configurar provider e wallet
      const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
      const wallet = new ethers.Wallet(privateKey, provider);

      logger.info('Wallet configured', {
        address: wallet.address,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
      });

      // 1. Verificar saldo
      await this.checkBalance(wallet, fromToken, amountWei);

      // 2. Obter cotação
      const quote = await this.getSwapQuote(
        fromToken.address,
        toToken.address,
        amountWei.toString()
      );

      logger.info('Swap quote obtained', {
        fromAmount: ethers.formatUnits(amountWei, fromToken.decimals),
        toAmount: ethers.formatUnits(quote.toAmount, toToken.decimals),
        gasEstimate: quote.gas,
      });

      // 3. Verificar/aprovar allowance
      await this.ensureAllowance(wallet, fromToken, quote.to, amountWei);

      // 4. Executar swap
      const swapTx = await this.executeSwapTransaction(wallet, quote);

      // 5. Aguardar confirmação
      const receipt = await swapTx.wait();

      logger.info('Swap completed successfully', {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
      });

      // 6. Salvar registro de swap
      const swapData = {
        id: `swap_${receipt.hash}`,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        fromAmount: ethers.formatUnits(amountWei, fromToken.decimals),
        toAmount: ethers.formatUnits(quote.toAmount, toToken.decimals),
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: swapTx.gasPrice?.toString(),
        timestamp: new Date(),
        status: 'completed',
        metadata,
      };

      await this.saveSwap(swapData);

      return {
        success: true,
        txHash: receipt.hash,
        fromAmount: swapData.fromAmount,
        toAmount: swapData.toAmount,
        outputAmount: swapData.toAmount,
        gasUsed: swapData.gasUsed,
        data: swapData,
      };

    } catch (error) {
      logger.error('Swap execution failed', {
        error: error.message,
        stack: error.stack,
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        amount,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtém cotação de swap da 1inch
   */
  async getSwapQuote(fromTokenAddress, toTokenAddress, amount) {
    try {
      logger.info('Getting swap quote from 1inch', {
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        amount,
      });

      // Primeiro, obter cotação simples
      const quoteResponse = await this.axiosInstance.get('/quote', {
        params: {
          src: fromTokenAddress,
          dst: toTokenAddress,
          amount: amount,
        },
      });

      const quote = quoteResponse.data;

      logger.info('Quote received', {
        fromAmount: amount,
        toAmount: quote.toAmount,
        gasEstimate: quote.gas,
      });

      // Depois, obter dados de transação
      const swapResponse = await this.axiosInstance.get('/swap', {
        params: {
          src: fromTokenAddress,
          dst: toTokenAddress,
          amount: amount,
          from: process.env.BASE_WALLET_ADDRESS,
          slippage: this.config.slippage,
          disableEstimate: true,
        },
      });

      const swapData = swapResponse.data;

      return {
        ...quote,
        to: swapData.tx.to,
        data: swapData.tx.data,
        value: swapData.tx.value,
        gasPrice: swapData.tx.gasPrice,
        gas: swapData.tx.gas,
      };

    } catch (error) {
      logger.error('Error getting swap quote', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // Fallback para cotação simulada em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        return this.getSimulatedQuote(fromTokenAddress, toTokenAddress, amount);
      }

      throw error;
    }
  }

  /**
   * Cotação simulada para desenvolvimento
   */
  getSimulatedQuote(fromTokenAddress, toTokenAddress, amount) {
    logger.warn('Using simulated quote for development');

    // Taxas de câmbio simuladas
    const rates = {
      [`${this.tokens.USDC.address}_${this.tokens.BRZ.address}`]: 5.5, // 1 USDC = 5.5 BRZ
      [`${this.tokens.BRZ.address}_${this.tokens.USDC.address}`]: 0.18, // 1 BRZ = 0.18 USDC
      [`${this.tokens.EURC.address}_${this.tokens.USDC.address}`]: 1.1, // 1 EURC = 1.1 USDC
      [`${this.tokens.USDC.address}_${this.tokens.EURC.address}`]: 0.91, // 1 USDC = 0.91 EURC
    };

    const rateKey = `${fromTokenAddress}_${toTokenAddress}`;
    const rate = rates[rateKey] || 1;

    const fromToken = Object.values(this.tokens).find(t => t.address === fromTokenAddress);
    const toToken = Object.values(this.tokens).find(t => t.address === toTokenAddress);

    const fromAmount = new BigNumber(amount);
    const toAmount = fromAmount
      .multipliedBy(rate)
      .multipliedBy(new BigNumber(10).pow(toToken.decimals))
      .dividedBy(new BigNumber(10).pow(fromToken.decimals))
      .integerValue();

    return {
      toAmount: toAmount.toString(),
      gas: '200000',
      gasPrice: '1000000000',
      to: '0x1111111254EEB25477B68fb85Ed929f73A960582', // 1inch router
      data: '0x12aa3caf', // Dados simulados
      value: '0',
    };
  }

  /**
   * Verifica saldo do token
   */
  async checkBalance(wallet, token, requiredAmount) {
    try {
      const contract = new ethers.Contract(token.address, this.erc20Abi, wallet);
      const balance = await contract.balanceOf(wallet.address);

      if (balance < requiredAmount) {
        throw new Error(
          `Insufficient balance. Required: ${ethers.formatUnits(requiredAmount, token.decimals)} ${token.symbol}, Available: ${ethers.formatUnits(balance, token.decimals)} ${token.symbol}`
        );
      }

      logger.info('Balance check passed', {
        token: token.symbol,
        required: ethers.formatUnits(requiredAmount, token.decimals),
        available: ethers.formatUnits(balance, token.decimals),
      });

    } catch (error) {
      logger.error('Balance check failed', {
        error: error.message,
        token: token.symbol,
      });
      throw error;
    }
  }

  /**
   * Garante allowance suficiente para o swap
   */
  async ensureAllowance(wallet, token, spender, amount) {
    try {
      const contract = new ethers.Contract(token.address, this.erc20Abi, wallet);
      
      // Verificar allowance atual
      const currentAllowance = await contract.allowance(wallet.address, spender);

      if (currentAllowance < amount) {
        logger.info('Insufficient allowance, approving tokens', {
          token: token.symbol,
          spender,
          currentAllowance: ethers.formatUnits(currentAllowance, token.decimals),
          requiredAmount: ethers.formatUnits(amount, token.decimals),
        });

        // Aprovar quantidade máxima para evitar aprovações futuras
        const maxAmount = ethers.MaxUint256;
        const approveTx = await contract.approve(spender, maxAmount);
        
        logger.info('Approval transaction sent', {
          txHash: approveTx.hash,
        });

        // Aguardar confirmação
        await approveTx.wait();

        logger.info('Token approval confirmed', {
          txHash: approveTx.hash,
          token: token.symbol,
        });
      } else {
        logger.info('Sufficient allowance already exists', {
          token: token.symbol,
          allowance: ethers.formatUnits(currentAllowance, token.decimals),
        });
      }

    } catch (error) {
      logger.error('Error ensuring allowance', {
        error: error.message,
        token: token.symbol,
      });
      throw error;
    }
  }

  /**
   * Executa transação de swap
   */
  async executeSwapTransaction(wallet, quote) {
    try {
      logger.info('Executing swap transaction', {
        to: quote.to,
        value: quote.value,
        gasLimit: quote.gas,
      });

      const tx = await wallet.sendTransaction({
        to: quote.to,
        data: quote.data,
        value: quote.value || '0',
        gasLimit: quote.gas,
        gasPrice: quote.gasPrice,
      });

      logger.info('Swap transaction sent', {
        txHash: tx.hash,
        nonce: tx.nonce,
      });

      return tx;

    } catch (error) {
      logger.error('Error executing swap transaction', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Obtém melhor rota para swap
   */
  async getBestRoute(fromTokenSymbol, toTokenSymbol, amount) {
    try {
      const fromToken = this.tokens[fromTokenSymbol];
      const toToken = this.tokens[toTokenSymbol];

      if (!fromToken || !toToken) {
        throw new Error(`Unsupported token pair: ${fromTokenSymbol} -> ${toTokenSymbol}`);
      }

      const amountWei = ethers.parseUnits(amount.toString(), fromToken.decimals);

      const quote = await this.getSwapQuote(
        fromToken.address,
        toToken.address,
        amountWei.toString()
      );

      return {
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        fromAmount: amount,
        toAmount: ethers.formatUnits(quote.toAmount, toToken.decimals),
        gasEstimate: quote.gas,
        route: quote.protocols || [], // Rotas da 1inch
      };

    } catch (error) {
      logger.error('Error getting best route', {
        error: error.message,
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
      });
      throw error;
    }
  }

  /**
   * Salva registro de swap (placeholder)
   */
  async saveSwap(swapData) {
    // TODO: Implementar persistência real
    logger.info('Saving swap (placeholder)', {
      id: swapData.id,
      fromToken: swapData.fromToken,
      toToken: swapData.toToken,
      fromAmount: swapData.fromAmount,
      toAmount: swapData.toAmount,
    });

    // Placeholder em memória
    if (!global.swaps) {
      global.swaps = new Map();
    }
    global.swaps.set(swapData.id, swapData);
  }

  /**
   * Obtém histórico de swaps
   */
  getSwapHistory(limit = 50) {
    // TODO: Implementar busca real no banco
    if (!global.swaps) {
      return [];
    }

    return Array.from(global.swaps.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Calcula preço de impacto
   */
  async calculatePriceImpact(fromTokenSymbol, toTokenSymbol, amount) {
    try {
      // Obter cotação para quantidade pequena (referência)
      const smallAmount = '1';
      const smallQuote = await this.getBestRoute(fromTokenSymbol, toTokenSymbol, smallAmount);

      // Obter cotação para quantidade solicitada
      const largeQuote = await this.getBestRoute(fromTokenSymbol, toTokenSymbol, amount);

      // Calcular preço por unidade
      const smallPrice = parseFloat(smallQuote.toAmount) / parseFloat(smallQuote.fromAmount);
      const largePrice = parseFloat(largeQuote.toAmount) / parseFloat(largeQuote.fromAmount);

      // Calcular impacto percentual
      const priceImpact = ((smallPrice - largePrice) / smallPrice) * 100;

      return {
        priceImpact: Math.max(0, priceImpact), // Não pode ser negativo
        smallOrderPrice: smallPrice,
        largeOrderPrice: largePrice,
        fromAmount: amount,
        toAmount: largeQuote.toAmount,
      };

    } catch (error) {
      logger.error('Error calculating price impact', {
        error: error.message,
      });
      return {
        priceImpact: 0,
        error: error.message,
      };
    }
  }

  /**
   * Verifica se swap é viável
   */
  async isSwapViable(fromTokenSymbol, toTokenSymbol, amount, maxPriceImpact = 5) {
    try {
      const priceImpactData = await this.calculatePriceImpact(
        fromTokenSymbol,
        toTokenSymbol,
        amount
      );

      const isViable = priceImpactData.priceImpact <= maxPriceImpact;

      logger.info('Swap viability check', {
        fromToken: fromTokenSymbol,
        toToken: toTokenSymbol,
        amount,
        priceImpact: priceImpactData.priceImpact,
        maxAllowed: maxPriceImpact,
        isViable,
      });

      return {
        isViable,
        priceImpact: priceImpactData.priceImpact,
        maxAllowed: maxPriceImpact,
        estimatedOutput: priceImpactData.toAmount,
      };

    } catch (error) {
      logger.error('Error checking swap viability', {
        error: error.message,
      });
      return {
        isViable: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtém status do serviço
   */
  async getServiceStatus() {
    try {
      // Testar conectividade com 1inch
      let apiStatus = 'unknown';
      try {
        const response = await this.axiosInstance.get('/healthcheck', { timeout: 5000 });
        apiStatus = response.status === 200 ? 'operational' : 'degraded';
      } catch {
        apiStatus = 'down';
      }

      return {
        apiStatus,
        supportedTokens: Object.keys(this.tokens),
        chainId: this.config.chainId,
        slippage: this.config.slippage,
        hasApiKey: !!this.config.apiKey,
      };

    } catch (error) {
      logger.error('Error getting service status', {
        error: error.message,
      });
      return {
        apiStatus: 'error',
        error: error.message,
      };
    }
  }
}

module.exports = SwapService; 