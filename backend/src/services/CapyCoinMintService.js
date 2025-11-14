const { ethers } = require('ethers');
const logger = require('../utils/logger');

/**
 * CapyCoinMintService - Responsável por mintar CAPY on-chain
 * Requer as variáveis de ambiente:
 * - CAPYCOIN_ADDRESS: endereço do contrato CapyCoin
 * - BASE_RPC_URL: RPC da rede Base (ou testnet)
 * - BASE_PRIVATE_KEY: chave do minter (tem MINTER_ROLE no contrato)
 */
class CapyCoinMintService {
  constructor() {
    this.contractAddress = process.env.CAPYCOIN_ADDRESS;
    this.rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_TESTNET_RPC_URL;
    this.privateKey = process.env.BASE_PRIVATE_KEY;
    this.isConfigured = !!(this.contractAddress && this.rpcUrl && this.privateKey);

    if (!this.isConfigured) {
      logger.warn('CapyCoinMintService not fully configured', {
        hasAddress: !!this.contractAddress,
        hasRpc: !!this.rpcUrl,
        hasKey: !!this.privateKey,
      });
      // Evitar lançar erro na inicialização do servidor em ambientes sem configuração
      this.provider = null;
      this.wallet = null;
      this.abi = null;
      this.contract = null;
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      this.wallet = new ethers.Wallet(this.privateKey, this.provider);

      // ABI mínima apenas com funções necessárias
      this.abi = [
        'function mint(address to, uint256 amount) external',
        'function decimals() view returns (uint8)',
        'function transfer(address to, uint256 amount) external returns (bool)',
        'function balanceOf(address account) view returns (uint256)'
        // Opcional: alguns contratos podem expor verificação de permissão.
        // 'function canMint(address minter) view returns (bool)'
      ];

      this.contract = new ethers.Contract(this.contractAddress, this.abi, this.wallet);
    } catch (error) {
      logger.error('Failed to initialize CapyCoinMintService', { error: error.message });
      this.isConfigured = false;
    }
  }

  async canMintOptional() {
    try {
      if (typeof this.contract.canMint !== 'function') return null;
      return await this.contract.canMint(this.wallet.address);
    } catch (error) {
      logger.warn('CapyCoin canMint check not available', { error: error.message });
      return null;
    }
  }

  /**
   * Mint CAPY para um usuário.
   * @param {string} to - endereço do usuário (0x...)
   * @param {string|number} capyAmount - quantidade em CAPY (unidades, não wei)
   */
  async mintToUser(to, capyAmount) {
    try {
      if (!this.isConfigured || !this.contract || !this.wallet) {
        return { success: false, error: 'CapyCoinMintService not configured' };
      }
      if (!ethers.isAddress(to)) {
        throw new Error('Invalid recipient address');
      }

      const decimals = await this.contract.decimals();
      const amountWei = ethers.parseUnits(capyAmount.toString(), decimals);

      logger.info('Minting CAPY tokens', {
        to,
        capyAmount,
        amountWei: amountWei.toString(),
        contract: this.contractAddress,
      });

      const canMint = await this.canMintOptional();
      if (canMint === false) {
        // Se o contrato expõe a checagem e retorna false, avisar mas tentar mesmo assim
        logger.warn('Backend wallet may not have MINTER_ROLE; attempting mint');
      }

      const tx = await this.contract.mint(to, amountWei);
      const receipt = await tx.wait();

      const txHash = receipt?.hash || receipt?.transactionHash || tx?.hash;

      logger.info('Mint transaction confirmed', {
        txHash,
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString(),
      });

      return {
        success: true,
        txHash,
      };
    } catch (error) {
      logger.error('Failed to mint CAPY tokens', {
        error: error.message,
        to,
        capyAmount,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Transferir CAPY do backend para um usuário.
   * Requer que a carteira backend possua saldo suficiente de CAPY.
   * @param {string} to - endereço do usuário (0x...)
   * @param {string|number} capyAmount - quantidade em CAPY (unidades, não wei)
   */
  async transferToUser(to, capyAmount) {
    try {
      if (!this.isConfigured || !this.contract || !this.wallet) {
        return { success: false, error: 'CapyCoinMintService not configured' };
      }
      if (!ethers.isAddress(to)) {
        throw new Error('Invalid recipient address');
      }

      const decimals = await this.contract.decimals();
      const amountWei = ethers.parseUnits(capyAmount.toString(), decimals);

      // Verificar saldo do backend
      const backendAddress = await this.wallet.getAddress();
      const balanceWei = await this.contract.balanceOf(backendAddress);

      if (balanceWei < amountWei) {
        throw new Error('Insufficient CAPY balance for transfer');
      }

      logger.info('Transferring CAPY tokens', {
        to,
        capyAmount,
        amountWei: amountWei.toString(),
        from: backendAddress,
        contract: this.contractAddress,
      });

      const tx = await this.contract.transfer(to, amountWei);
      const receipt = await tx.wait();
      const txHash = receipt?.hash || receipt?.transactionHash || tx?.hash;

      logger.info('Transfer transaction confirmed', {
        txHash,
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString(),
      });

      return { success: true, txHash };
    } catch (error) {
      logger.error('Failed to transfer CAPY tokens', {
        error: error.message,
        to,
        capyAmount,
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = CapyCoinMintService;