const { ethers } = require('ethers');
const logger = require('../utils/logger');

/**
 * DepositRegistryService - Registra depósitos PIX onchain (evento)
 * Requer as variáveis de ambiente:
 * - DEPOSIT_REGISTRY_ADDRESS
 * - BASE_RPC_URL
 * - BASE_PRIVATE_KEY (wallet com RECORD_ROLE)
 */
class DepositRegistryService {
  constructor() {
    this.contractAddress = process.env.DEPOSIT_REGISTRY_ADDRESS;
    this.rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_TESTNET_RPC_URL;
    this.privateKey = process.env.BASE_PRIVATE_KEY;
    this.isConfigured = !!(this.contractAddress && this.rpcUrl && this.privateKey);

    if (!this.isConfigured) {
      logger.warn('DepositRegistryService not fully configured', {
        hasAddress: !!this.contractAddress,
        hasRpc: !!this.rpcUrl,
        hasKey: !!this.privateKey,
      });
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      this.wallet = new ethers.Wallet(this.privateKey, this.provider);
      this.abi = [
        'function recordPixDeposit(bytes32 depositId, address user, uint256 amountInCents, string externalId) external',
      ];
      this.contract = new ethers.Contract(this.contractAddress, this.abi, this.wallet);
    } catch (error) {
      logger.error('Failed to initialize DepositRegistryService', { error: error.message });
      this.isConfigured = false;
    }
  }

  /**
   * Registra depósito PIX onchain via evento
   * @param {string} depositIdStr - ID (string) do brcode/depósito
   * @param {string} userAddress - Endereço do usuário (0x...)
   * @param {number} amountInCents - Valor em centavos BRL
   * @param {string} externalId - Referência externa (ex: StarkBank externalId)
   */
  async recordPixDeposit(depositIdStr, userAddress, amountInCents, externalId) {
    try {
      if (!this.isConfigured || !this.contract) {
        return { success: false, error: 'DepositRegistryService not configured' };
      }

      if (!ethers.isAddress(userAddress)) {
        throw new Error('Invalid user address');
      }

      // Converter string para bytes32 determinístico (hash)
      const depositId = ethers.keccak256(ethers.toUtf8Bytes(depositIdStr));

      const tx = await this.contract.recordPixDeposit(depositId, userAddress, amountInCents, externalId || '');
      const receipt = await tx.wait();
      const txHash = receipt?.hash || tx?.hash;

      logger.info('Pix deposit recorded onchain', {
        txHash,
        depositIdStr,
        userAddress,
        amountInCents,
      });

      return { success: true, txHash };
    } catch (error) {
      logger.error('Failed to record pix deposit onchain', {
        error: error.message,
        depositIdStr,
        userAddress,
        amountInCents,
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = DepositRegistryService;