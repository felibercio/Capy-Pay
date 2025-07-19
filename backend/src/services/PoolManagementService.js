const BigNumber = require('bignumber.js');
const winston = require('winston');

/**
 * PoolManagementService - Gerencia a pool de lastro da BRcapy
 * 
 * Responsabilidades:
 * - Gerenciar reservas em stablecoins que lastreiam a BRcapy
 * - Processar revenue das transações do app
 * - Calcular e distribuir taxas internas
 * - Manter liquidez adequada para resgates
 * - Monitorar saúde financeira da pool
 * 
 * Fluxo de Fundos:
 * 1. Usuários fazem transações (swap, boleto, etc.)
 * 2. Taxas são coletadas e enviadas para a pool
 * 3. Revenue é convertido em rendimento para BRcapy
 * 4. Pool mantém reservas para resgates
 */
class PoolManagementService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/pool-management.log' }),
                new winston.transports.Console()
            ]
        });

        // Configurações da pool
        this.config = {
            // Reserva mínima de segurança (% da supply total de BRcapy)
            minimumReserveRatio: 0.2, // 20%
            
            // Reserva ideal para operação saudável
            targetReserveRatio: 0.5, // 50%
            
            // Limite máximo de utilização da pool
            maxUtilizationRate: 0.8, // 80%
            
            // Percentual do revenue que vai para BRcapy holders
            brcapyDistributionRate: 0.7, // 70%
            
            // Percentual que fica na reserva de segurança
            reserveAllocationRate: 0.2, // 20%
            
            // Percentual para desenvolvimento/operação
            operationalRate: 0.1, // 10%
            
            // Assets aceitos na pool
            acceptedAssets: ['USDC', 'USDT', 'BUSD', 'BRL'],
            
            // Pesos dos assets para cálculo de valor total
            assetWeights: {
                'USDC': 1.0,
                'USDT': 0.98,
                'BUSD': 0.97,
                'BRL': 1.0
            }
        };

        // Estado da pool
        this.poolState = {
            // Reservas por asset
            reserves: {
                'USDC': new BigNumber('0'),
                'USDT': new BigNumber('0'),
                'BUSD': new BigNumber('0'),
                'BRL': new BigNumber('0')
            },
            
            // Valor total da pool em BRL
            totalValueBRL: new BigNumber('0'),
            
            // Revenue acumulado
            totalRevenue: new BigNumber('0'),
            dailyRevenue: new BigNumber('0'),
            
            // Métricas de utilização
            utilizationRate: 0,
            reserveRatio: 1.0,
            
            // Status da pool
            status: 'healthy', // healthy, warning, critical
            lastUpdate: new Date().toISOString()
        };

        // Histórico de transações da pool
        this.transactionHistory = [];
        
        // Métricas de performance
        this.metrics = {
            totalTransactionsProcessed: 0,
            totalVolumeProcessed: new BigNumber('0'),
            averageDailyRevenue: new BigNumber('0'),
            revenueGrowthRate: 0,
            poolHealthScore: 100
        };

        // Taxas por tipo de transação (% do valor)
        this.transactionFees = {
            'crypto_swap': 0.005, // 0.5%
            'boleto_payment': 0.015, // 1.5%
            'pix_transfer': 0.001, // 0.1%
            'international_transfer': 0.025, // 2.5%
            'card_transaction': 0.02 // 2.0%
        };

        this.logger.info('PoolManagementService initialized', {
            minimumReserveRatio: this.config.minimumReserveRatio,
            targetReserveRatio: this.config.targetReserveRatio,
            brcapyDistributionRate: this.config.brcapyDistributionRate
        });
    }

    /**
     * Processa revenue de uma transação do app
     * @param {string} transactionType - Tipo da transação
     * @param {number} transactionAmount - Valor da transação
     * @param {string} asset - Asset da transação
     * @param {Object} metadata - Metadados adicionais
     */
    async processTransactionRevenue(transactionType, transactionAmount, asset = 'BRL', metadata = {}) {
        try {
            const amount = new BigNumber(transactionAmount);
            
            if (amount.isLessThanOrEqualTo(0)) {
                return {
                    success: false,
                    error: 'Transaction amount must be greater than zero'
                };
            }

            // Calcular taxa baseada no tipo de transação
            const feeRate = this.transactionFees[transactionType] || 0.01; // 1% padrão
            const feeAmount = amount.multipliedBy(feeRate);

            // Converter para BRL se necessário
            const feeInBRL = await this.convertToBRL(feeAmount, asset);

            // Distribuir o revenue
            const distribution = this.calculateRevenueDistribution(feeInBRL);

            // Atualizar reservas
            await this.updateReserves(distribution.toReserve, 'BRL', 'transaction_fee');
            
            // Atualizar métricas de revenue
            this.poolState.dailyRevenue = this.poolState.dailyRevenue.plus(distribution.toBRcapy);
            this.poolState.totalRevenue = this.poolState.totalRevenue.plus(feeInBRL);

            // Registrar transação
            const transactionRecord = {
                id: this.generateTransactionId(),
                type: 'revenue_processing',
                transactionType,
                originalAmount: amount.toFixed(8),
                originalAsset: asset,
                feeAmount: feeAmount.toFixed(8),
                feeInBRL: feeInBRL.toFixed(2),
                distribution,
                timestamp: new Date().toISOString(),
                metadata
            };

            this.transactionHistory.unshift(transactionRecord);
            
            // Manter apenas últimas 1000 transações
            if (this.transactionHistory.length > 1000) {
                this.transactionHistory = this.transactionHistory.slice(0, 1000);
            }

            // Atualizar métricas
            await this.updateMetrics();

            // Verificar saúde da pool
            await this.checkPoolHealth();

            this.logger.info('Transaction revenue processed', {
                transactionType,
                originalAmount: amount.toFixed(2),
                asset,
                feeInBRL: feeInBRL.toFixed(2),
                distribution: {
                    toBRcapy: distribution.toBRcapy.toFixed(2),
                    toReserve: distribution.toReserve.toFixed(2),
                    toOperational: distribution.toOperational.toFixed(2)
                }
            });

            return {
                success: true,
                data: {
                    transactionId: transactionRecord.id,
                    feeAmount: feeAmount.toFixed(8),
                    feeInBRL: feeInBRL.toFixed(2),
                    distribution,
                    poolStatus: this.poolState.status
                }
            };

        } catch (error) {
            this.logger.error('Error processing transaction revenue', {
                transactionType,
                transactionAmount,
                asset,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: 'Failed to process transaction revenue'
            };
        }
    }

    /**
     * Calcula distribuição do revenue
     * @param {BigNumber} totalRevenue - Revenue total a ser distribuído
     */
    calculateRevenueDistribution(totalRevenue) {
        const toBRcapy = totalRevenue.multipliedBy(this.config.brcapyDistributionRate);
        const toReserve = totalRevenue.multipliedBy(this.config.reserveAllocationRate);
        const toOperational = totalRevenue.multipliedBy(this.config.operationalRate);

        return {
            toBRcapy,
            toReserve,
            toOperational,
            total: totalRevenue
        };
    }

    /**
     * Atualiza reservas da pool
     * @param {BigNumber} amount - Valor a ser adicionado
     * @param {string} asset - Asset a ser adicionado
     * @param {string} reason - Motivo da adição
     */
    async updateReserves(amount, asset, reason) {
        try {
            if (!this.config.acceptedAssets.includes(asset)) {
                throw new Error(`Asset ${asset} not accepted in pool`);
            }

            // Atualizar reserva do asset específico
            if (!this.poolState.reserves[asset]) {
                this.poolState.reserves[asset] = new BigNumber('0');
            }

            this.poolState.reserves[asset] = this.poolState.reserves[asset].plus(amount);

            // Recalcular valor total da pool
            await this.recalculatePoolValue();

            // Registrar operação
            this.transactionHistory.unshift({
                id: this.generateTransactionId(),
                type: 'reserve_update',
                asset,
                amount: amount.toFixed(8),
                reason,
                newReserve: this.poolState.reserves[asset].toFixed(8),
                timestamp: new Date().toISOString()
            });

            this.logger.debug('Reserves updated', {
                asset,
                amount: amount.toFixed(8),
                reason,
                newReserve: this.poolState.reserves[asset].toFixed(8),
                totalPoolValue: this.poolState.totalValueBRL.toFixed(2)
            });

        } catch (error) {
            this.logger.error('Error updating reserves', {
                amount: amount.toString(),
                asset,
                reason,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Recalcula valor total da pool em BRL
     */
    async recalculatePoolValue() {
        let totalValue = new BigNumber('0');

        for (const [asset, amount] of Object.entries(this.poolState.reserves)) {
            if (amount && amount.isGreaterThan(0)) {
                const valueInBRL = await this.convertToBRL(amount, asset);
                const weight = this.config.assetWeights[asset] || 1.0;
                const weightedValue = valueInBRL.multipliedBy(weight);
                
                totalValue = totalValue.plus(weightedValue);
            }
        }

        this.poolState.totalValueBRL = totalValue;
        this.poolState.lastUpdate = new Date().toISOString();

        // Recalcular métricas de utilização
        await this.calculateUtilizationMetrics();
    }

    /**
     * Calcula métricas de utilização da pool
     */
    async calculateUtilizationMetrics() {
        // Para calcular utilização, precisamos do total supply de BRcapy
        // Em uma implementação real, isso viria do BRcapyService
        const estimatedBRcapySupply = new BigNumber('1000000'); // Placeholder

        if (this.poolState.totalValueBRL.isGreaterThan(0)) {
            this.poolState.utilizationRate = estimatedBRcapySupply
                .dividedBy(this.poolState.totalValueBRL)
                .toNumber();
                
            this.poolState.reserveRatio = this.poolState.totalValueBRL
                .dividedBy(estimatedBRcapySupply)
                .toNumber();
        }
    }

    /**
     * Converte valor para BRL (simulado para MVP)
     * @param {BigNumber} amount - Valor a ser convertido
     * @param {string} fromAsset - Asset de origem
     */
    async convertToBRL(amount, fromAsset) {
        // Taxas de câmbio simuladas (em produção, usar API real)
        const exchangeRates = {
            'BRL': 1.0,
            'USDC': 5.2, // 1 USDC = 5.20 BRL
            'USDT': 5.18, // 1 USDT = 5.18 BRL
            'BUSD': 5.15, // 1 BUSD = 5.15 BRL
            'USD': 5.2
        };

        const rate = exchangeRates[fromAsset] || 1.0;
        return amount.multipliedBy(rate);
    }

    /**
     * Verifica saúde da pool e atualiza status
     */
    async checkPoolHealth() {
        let healthScore = 100;
        let status = 'healthy';
        const issues = [];

        // Verificar reserva mínima
        if (this.poolState.reserveRatio < this.config.minimumReserveRatio) {
            healthScore -= 40;
            status = 'critical';
            issues.push('Reserve ratio below minimum threshold');
        } else if (this.poolState.reserveRatio < this.config.targetReserveRatio) {
            healthScore -= 20;
            status = 'warning';
            issues.push('Reserve ratio below target');
        }

        // Verificar utilização
        if (this.poolState.utilizationRate > this.config.maxUtilizationRate) {
            healthScore -= 30;
            status = 'critical';
            issues.push('Utilization rate too high');
        } else if (this.poolState.utilizationRate > (this.config.maxUtilizationRate * 0.8)) {
            healthScore -= 15;
            if (status === 'healthy') status = 'warning';
            issues.push('Utilization rate approaching limit');
        }

        // Verificar diversificação de assets
        const assetCount = Object.values(this.poolState.reserves)
            .filter(amount => amount && amount.isGreaterThan(0)).length;
        
        if (assetCount < 2) {
            healthScore -= 10;
            if (status === 'healthy') status = 'warning';
            issues.push('Low asset diversification');
        }

        this.poolState.status = status;
        this.metrics.poolHealthScore = Math.max(healthScore, 0);

        if (issues.length > 0) {
            this.logger.warn('Pool health issues detected', {
                status,
                healthScore: this.metrics.poolHealthScore,
                issues,
                reserveRatio: this.poolState.reserveRatio,
                utilizationRate: this.poolState.utilizationRate
            });
        }
    }

    /**
     * Atualiza métricas de performance
     */
    async updateMetrics() {
        // Calcular revenue médio diário (últimos 30 dias)
        const recentTransactions = this.transactionHistory
            .filter(tx => tx.type === 'revenue_processing')
            .slice(0, 30);

        if (recentTransactions.length > 0) {
            const totalRevenue = recentTransactions.reduce((sum, tx) => {
                return sum.plus(new BigNumber(tx.feeInBRL));
            }, new BigNumber('0'));

            this.metrics.averageDailyRevenue = totalRevenue.dividedBy(Math.min(recentTransactions.length, 30));
        }

        // Calcular taxa de crescimento de revenue
        const last30Days = this.transactionHistory
            .filter(tx => tx.type === 'revenue_processing')
            .slice(0, 30);
        
        const previous30Days = this.transactionHistory
            .filter(tx => tx.type === 'revenue_processing')
            .slice(30, 60);

        if (last30Days.length > 0 && previous30Days.length > 0) {
            const recentRevenue = last30Days.reduce((sum, tx) => 
                sum.plus(new BigNumber(tx.feeInBRL)), new BigNumber('0'));
            
            const previousRevenue = previous30Days.reduce((sum, tx) => 
                sum.plus(new BigNumber(tx.feeInBRL)), new BigNumber('0'));

            if (previousRevenue.isGreaterThan(0)) {
                this.metrics.revenueGrowthRate = recentRevenue
                    .dividedBy(previousRevenue)
                    .minus(1)
                    .multipliedBy(100)
                    .toNumber();
            }
        }

        this.metrics.totalTransactionsProcessed = this.transactionHistory
            .filter(tx => tx.type === 'revenue_processing').length;

        this.metrics.totalVolumeProcessed = this.transactionHistory
            .filter(tx => tx.type === 'revenue_processing')
            .reduce((sum, tx) => sum.plus(new BigNumber(tx.originalAmount)), new BigNumber('0'));
    }

    /**
     * Processa resgate de BRcapy (retirada de reservas)
     * @param {string} userId - ID do usuário
     * @param {BigNumber} brcapyAmount - Quantidade de BRcapy a ser resgatada
     * @param {string} targetAsset - Asset desejado para resgate
     */
    async processRedemption(userId, brcapyAmount, targetAsset = 'BRL') {
        try {
            if (!this.config.acceptedAssets.includes(targetAsset)) {
                return {
                    success: false,
                    error: `Asset ${targetAsset} not supported for redemption`
                };
            }

            // Calcular valor em BRL (assumindo preço da BRcapy = 1.05 BRL para exemplo)
            const brcapyPriceBRL = new BigNumber('1.05'); // Em produção, vem do BRcapyService
            const redeemValueBRL = brcapyAmount.multipliedBy(brcapyPriceBRL);

            // Converter para asset desejado
            const redeemValueInAsset = await this.convertFromBRL(redeemValueBRL, targetAsset);

            // Verificar se há reservas suficientes
            const availableReserve = this.poolState.reserves[targetAsset] || new BigNumber('0');
            
            if (availableReserve.isLessThan(redeemValueInAsset)) {
                return {
                    success: false,
                    error: 'Insufficient reserves for redemption',
                    details: {
                        requested: redeemValueInAsset.toFixed(8),
                        available: availableReserve.toFixed(8),
                        asset: targetAsset
                    }
                };
            }

            // Verificar se resgate não compromete saúde da pool
            const newReserve = availableReserve.minus(redeemValueInAsset);
            const newTotalValue = this.poolState.totalValueBRL.minus(redeemValueBRL);
            const newReserveRatio = newTotalValue.dividedBy(this.poolState.totalValueBRL).toNumber();

            if (newReserveRatio < this.config.minimumReserveRatio) {
                return {
                    success: false,
                    error: 'Redemption would compromise pool safety',
                    details: {
                        currentReserveRatio: this.poolState.reserveRatio,
                        newReserveRatio,
                        minimumRequired: this.config.minimumReserveRatio
                    }
                };
            }

            // Processar resgate
            this.poolState.reserves[targetAsset] = newReserve;
            await this.recalculatePoolValue();

            // Registrar transação
            const redemptionRecord = {
                id: this.generateTransactionId(),
                type: 'redemption',
                userId,
                brcapyAmount: brcapyAmount.toFixed(8),
                redeemValue: redeemValueInAsset.toFixed(8),
                asset: targetAsset,
                brcapyPrice: brcapyPriceBRL.toFixed(8),
                timestamp: new Date().toISOString()
            };

            this.transactionHistory.unshift(redemptionRecord);

            // Atualizar métricas e verificar saúde
            await this.updateMetrics();
            await this.checkPoolHealth();

            this.logger.info('Redemption processed successfully', {
                userId,
                brcapyAmount: brcapyAmount.toFixed(8),
                redeemValue: redeemValueInAsset.toFixed(8),
                asset: targetAsset,
                newPoolValue: this.poolState.totalValueBRL.toFixed(2)
            });

            return {
                success: true,
                data: {
                    transactionId: redemptionRecord.id,
                    brcapyAmount: brcapyAmount.toFixed(8),
                    redeemValue: redeemValueInAsset.toFixed(8),
                    asset: targetAsset,
                    newPoolStatus: this.poolState.status
                }
            };

        } catch (error) {
            this.logger.error('Error processing redemption', {
                userId,
                brcapyAmount: brcapyAmount.toString(),
                targetAsset,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to process redemption'
            };
        }
    }

    /**
     * Converte valor de BRL para outro asset
     * @param {BigNumber} amount - Valor em BRL
     * @param {string} toAsset - Asset de destino
     */
    async convertFromBRL(amount, toAsset) {
        const exchangeRates = {
            'BRL': 1.0,
            'USDC': 1/5.2,
            'USDT': 1/5.18,
            'BUSD': 1/5.15,
            'USD': 1/5.2
        };

        const rate = exchangeRates[toAsset] || 1.0;
        return amount.multipliedBy(rate);
    }

    /**
     * Obtém dados da pool para dashboard
     */
    async getPoolDashboardData() {
        try {
            return {
                success: true,
                data: {
                    poolState: {
                        totalValueBRL: this.poolState.totalValueBRL.toFixed(2),
                        reserves: Object.fromEntries(
                            Object.entries(this.poolState.reserves).map(([asset, amount]) => [
                                asset,
                                amount.toFixed(8)
                            ])
                        ),
                        utilizationRate: (this.poolState.utilizationRate * 100).toFixed(2) + '%',
                        reserveRatio: (this.poolState.reserveRatio * 100).toFixed(2) + '%',
                        status: this.poolState.status,
                        dailyRevenue: this.poolState.dailyRevenue.toFixed(2),
                        totalRevenue: this.poolState.totalRevenue.toFixed(2)
                    },
                    metrics: {
                        ...this.metrics,
                        averageDailyRevenue: this.metrics.averageDailyRevenue.toFixed(2),
                        totalVolumeProcessed: this.metrics.totalVolumeProcessed.toFixed(2),
                        revenueGrowthRate: this.metrics.revenueGrowthRate.toFixed(2) + '%'
                    },
                    recentTransactions: this.transactionHistory.slice(0, 10)
                }
            };

        } catch (error) {
            this.logger.error('Error getting pool dashboard data', {
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to get pool dashboard data'
            };
        }
    }

    /**
     * Gera ID único para transação
     */
    generateTransactionId() {
        return 'pool_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Obtém histórico de transações da pool
     */
    getTransactionHistory(limit = 50, type = null) {
        let history = this.transactionHistory;
        
        if (type) {
            history = history.filter(tx => tx.type === type);
        }

        return history.slice(0, limit);
    }

    /**
     * Obtém métricas do sistema
     */
    getSystemMetrics() {
        return {
            poolState: {
                totalValueBRL: this.poolState.totalValueBRL.toFixed(2),
                utilizationRate: this.poolState.utilizationRate,
                reserveRatio: this.poolState.reserveRatio,
                status: this.poolState.status
            },
            metrics: {
                ...this.metrics,
                averageDailyRevenue: this.metrics.averageDailyRevenue.toFixed(2),
                totalVolumeProcessed: this.metrics.totalVolumeProcessed.toFixed(2)
            },
            reserves: Object.fromEntries(
                Object.entries(this.poolState.reserves).map(([asset, amount]) => [
                    asset,
                    amount.toFixed(8)
                ])
            )
        };
    }
}

module.exports = PoolManagementService; 