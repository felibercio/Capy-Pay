const BigNumber = require('bignumber.js');
const winston = require('winston');
const axios = require('axios');
const cron = require('node-cron');

/**
 * BRcapyService - Gerencia a BRcapy, a yieldcoin do Capy Pay
 * 
 * A BRcapy é uma stablecoin com rendimento que:
 * - É lastreada no CDI (Certificado de Depósito Interbancário)
 * - Cresce com as taxas internas geradas pelo uso do app
 * - Oferece rendimento real aos usuários
 * - Mantém transparência total na valorização
 * 
 * Fórmula de Valorização:
 * Valor_BRcapy_Novo = Valor_BRcapy_Anterior × (1 + CDI_Diário + Taxas_Internas_Diárias)
 * 
 * Onde:
 * - CDI_Diário = (Taxa_CDI_Anual / 365) / 100
 * - Taxas_Internas_Diárias = (Revenue_Diário / Pool_Total) × Fator_Distribuição
 */
class BRcapyService {
    constructor() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/brcapy.log' }),
                new winston.transports.Console()
            ]
        });

        // Configurações da BRcapy
        this.config = {
            // Valor inicial da BRcapy (em BRL)
            initialValue: new BigNumber('1.00'),
            
            // Fator de distribuição das taxas internas (% do revenue que vai para BRcapy)
            internalTaxDistributionFactor: 0.7, // 70% do revenue interno
            
            // Taxa mínima garantida (mesmo se CDI for negativo)
            minimumDailyYield: 0.0001, // 0.01% ao dia
            
            // Taxa máxima de proteção (cap para evitar volatilidade excessiva)
            maximumDailyYield: 0.005, // 0.5% ao dia
            
            // Fontes de dados CDI
            cdiSources: {
                primary: 'B3_API', // B3 - Brasil, Bolsa, Balcão
                fallback: 'BCB_API', // Banco Central do Brasil
                mock: 'SIMULATED' // Para desenvolvimento/testes
            },
            
            // Horário de atualização diária
            updateTime: '09:00', // 9h da manhã (após abertura do mercado)
            
            // Precisão decimal
            decimalPlaces: 8
        };

        // APIs de dados financeiros
        this.dataProviders = {
            B3: {
                url: 'https://api.b3.com.br/api/v1/indices/CDI',
                headers: {
                    'Authorization': `Bearer ${process.env.B3_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                rateLimit: 100 // requests por hora
            },
            BCB: {
                url: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json',
                headers: {
                    'User-Agent': 'CapyPay-BRcapy/1.0'
                },
                rateLimit: 1000 // requests por hora
            },
            MOCK: {
                baseRate: 13.75, // Taxa CDI base simulada (13.75% a.a.)
                volatility: 0.1 // Volatilidade de ±0.1% para simulação
            }
        };

        // Storage em memória para MVP - substituir por banco de dados
        this.brcapyData = {
            currentValue: this.config.initialValue,
            lastUpdate: new Date().toISOString(),
            dailyHistory: [], // Array de { date, value, cdi_rate, internal_rate, total_yield }
            totalSupply: new BigNumber('0'),
            totalPoolValue: new BigNumber('0')
        };

        // Balanços de usuários { userId -> { balance, lastUpdate, history } }
        this.userBalances = new Map();

        // Pool de lastro e revenue
        this.poolData = {
            stablecoinReserves: new BigNumber('0'), // Reservas em stablecoins
            dailyRevenue: new BigNumber('0'), // Revenue diário do app
            totalLiquidity: new BigNumber('0'), // Liquidez total disponível
            utilizationRate: 0 // Taxa de utilização da pool
        };

        // Métricas de performance
        this.metrics = {
            totalUsers: 0,
            averageDailyYield: 0,
            cumulativeYield: 0,
            apy: 0, // Annual Percentage Yield
            sharpeRatio: 0 // Risco vs retorno
        };

        // Inicializar sistema
        this.initializeBRcapy();
        this.startPeriodicUpdates();

        this.logger.info('BRcapyService initialized', {
            initialValue: this.config.initialValue.toString(),
            updateTime: this.config.updateTime
        });
    }

    /**
     * Inicializa o sistema BRcapy
     */
    async initializeBRcapy() {
        try {
            // Carregar dados históricos (em produção, do banco de dados)
            await this.loadHistoricalData();
            
            // Verificar se precisa de atualização
            const lastUpdate = new Date(this.brcapyData.lastUpdate);
            const now = new Date();
            const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
            
            if (hoursSinceUpdate >= 24) {
                this.logger.info('Performing initial BRcapy value update');
                await this.updateBRcapyValue();
            }

        } catch (error) {
            this.logger.error('Error initializing BRcapy', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * MÉTODO CENTRAL: Atualiza o valor da BRcapy
     * Combina CDI + taxas internas para calcular novo valor
     */
    async updateBRcapyValue() {
        try {
            this.logger.info('Starting BRcapy value update');

            // 1. Obter taxa CDI atual
            const cdiData = await this.fetchCurrentCDI();
            if (!cdiData.success) {
                throw new Error(`Failed to fetch CDI: ${cdiData.error}`);
            }

            const annualCDI = new BigNumber(cdiData.rate);
            const dailyCDI = annualCDI.dividedBy(365).dividedBy(100); // Converter para taxa diária decimal

            // 2. Calcular taxas internas baseadas no revenue do app
            const internalRates = await this.calculateInternalRates();

            // 3. Combinar taxas para yield total
            let totalDailyYield = dailyCDI.plus(internalRates.dailyRate);

            // 4. Aplicar limitadores de segurança
            totalDailyYield = BigNumber.maximum(totalDailyYield, this.config.minimumDailyYield);
            totalDailyYield = BigNumber.minimum(totalDailyYield, this.config.maximumDailyYield);

            // 5. Calcular novo valor da BRcapy
            const currentValue = this.brcapyData.currentValue;
            const newValue = currentValue.multipliedBy(new BigNumber(1).plus(totalDailyYield));

            // 6. Atualizar dados
            const updateData = {
                previousValue: currentValue,
                newValue: newValue,
                cdiRate: annualCDI,
                dailyCDI: dailyCDI,
                internalRate: internalRates.dailyRate,
                totalYield: totalDailyYield,
                poolValue: this.poolData.totalLiquidity,
                dailyRevenue: this.poolData.dailyRevenue,
                timestamp: new Date().toISOString()
            };

            // 7. Salvar novo valor
            this.brcapyData.currentValue = newValue;
            this.brcapyData.lastUpdate = updateData.timestamp;
            
            // 8. Adicionar ao histórico
            this.brcapyData.dailyHistory.unshift({
                date: updateData.timestamp.split('T')[0],
                value: newValue.toFixed(this.config.decimalPlaces),
                cdi_rate: annualCDI.toFixed(4),
                internal_rate: internalRates.dailyRate.multipliedBy(100).toFixed(4), // Em %
                total_yield: totalDailyYield.multipliedBy(100).toFixed(4), // Em %
                pool_value: this.poolData.totalLiquidity.toFixed(2),
                daily_revenue: this.poolData.dailyRevenue.toFixed(2)
            });

            // Manter apenas últimos 365 dias de histórico
            if (this.brcapyData.dailyHistory.length > 365) {
                this.brcapyData.dailyHistory = this.brcapyData.dailyHistory.slice(0, 365);
            }

            // 9. Atualizar métricas
            await this.updateMetrics(updateData);

            // 10. Distribuir rendimentos para usuários
            await this.distributeYieldToUsers(totalDailyYield);

            this.logger.info('BRcapy value updated successfully', {
                previousValue: currentValue.toFixed(8),
                newValue: newValue.toFixed(8),
                dailyYield: totalDailyYield.multipliedBy(100).toFixed(4) + '%',
                cdiContribution: dailyCDI.multipliedBy(100).toFixed(4) + '%',
                internalContribution: internalRates.dailyRate.multipliedBy(100).toFixed(4) + '%',
                poolValue: this.poolData.totalLiquidity.toFixed(2)
            });

            return {
                success: true,
                data: updateData
            };

        } catch (error) {
            this.logger.error('Error updating BRcapy value', {
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Busca a taxa CDI atual de fontes confiáveis
     */
    async fetchCurrentCDI() {
        const sources = [
            { name: 'B3', method: () => this.fetchCDIFromB3() },
            { name: 'BCB', method: () => this.fetchCDIFromBCB() },
            { name: 'MOCK', method: () => this.fetchCDIFromMock() }
        ];

        for (const source of sources) {
            try {
                this.logger.info(`Attempting to fetch CDI from ${source.name}`);
                const result = await source.method();
                
                if (result.success) {
                    this.logger.info(`CDI fetched successfully from ${source.name}`, {
                        rate: result.rate,
                        date: result.date
                    });
                    return result;
                }
            } catch (error) {
                this.logger.warn(`Failed to fetch CDI from ${source.name}`, {
                    error: error.message
                });
            }
        }

        return {
            success: false,
            error: 'All CDI sources failed'
        };
    }

    /**
     * Busca CDI da B3 (fonte primária)
     */
    async fetchCDIFromB3() {
        try {
            // Para MVP, usar fonte mockada
            if (process.env.NODE_ENV === 'development') {
                return this.fetchCDIFromMock();
            }

            const response = await axios.get(this.dataProviders.B3.url, {
                headers: this.dataProviders.B3.headers,
                timeout: 10000
            });

            if (response.data && response.data.rate) {
                return {
                    success: true,
                    rate: response.data.rate,
                    date: response.data.date,
                    source: 'B3'
                };
            }

            throw new Error('Invalid response format from B3');

        } catch (error) {
            return {
                success: false,
                error: error.message,
                source: 'B3'
            };
        }
    }

    /**
     * Busca CDI do Banco Central (fonte secundária)
     */
    async fetchCDIFromBCB() {
        try {
            const response = await axios.get(this.dataProviders.BCB.url, {
                headers: this.dataProviders.BCB.headers,
                timeout: 10000
            });

            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                const latest = response.data[response.data.length - 1];
                return {
                    success: true,
                    rate: parseFloat(latest.valor),
                    date: latest.data,
                    source: 'BCB'
                };
            }

            throw new Error('Invalid response format from BCB');

        } catch (error) {
            return {
                success: false,
                error: error.message,
                source: 'BCB'
            };
        }
    }

    /**
     * Simula taxa CDI para desenvolvimento/testes
     */
    async fetchCDIFromMock() {
        try {
            const mockConfig = this.dataProviders.MOCK;
            
            // Simular variação diária pequena
            const variation = (Math.random() - 0.5) * mockConfig.volatility;
            const simulatedRate = mockConfig.baseRate + variation;

            // Garantir que não seja negativo
            const finalRate = Math.max(simulatedRate, 0.1);

            return {
                success: true,
                rate: finalRate,
                date: new Date().toISOString().split('T')[0],
                source: 'MOCK',
                note: 'Simulated CDI rate for development'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                source: 'MOCK'
            };
        }
    }

    /**
     * Calcula taxas internas baseadas no revenue do app
     */
    async calculateInternalRates() {
        try {
            // Obter dados da pool de lastro
            await this.updatePoolData();

            const dailyRevenue = this.poolData.dailyRevenue;
            const totalPool = this.poolData.totalLiquidity;

            if (totalPool.isZero()) {
                return {
                    dailyRate: new BigNumber('0'),
                    source: 'empty_pool',
                    details: {
                        dailyRevenue: '0',
                        totalPool: '0',
                        distributionFactor: this.config.internalTaxDistributionFactor
                    }
                };
            }

            // Calcular taxa interna diária
            // Taxa = (Revenue Diário × Fator Distribuição) / Pool Total
            const distributableRevenue = dailyRevenue.multipliedBy(this.config.internalTaxDistributionFactor);
            const dailyRate = distributableRevenue.dividedBy(totalPool);

            return {
                dailyRate,
                source: 'calculated',
                details: {
                    dailyRevenue: dailyRevenue.toFixed(2),
                    distributableRevenue: distributableRevenue.toFixed(2),
                    totalPool: totalPool.toFixed(2),
                    distributionFactor: this.config.internalTaxDistributionFactor,
                    utilizationRate: this.poolData.utilizationRate
                }
            };

        } catch (error) {
            this.logger.error('Error calculating internal rates', {
                error: error.message
            });

            return {
                dailyRate: new BigNumber('0'),
                source: 'error',
                error: error.message
            };
        }
    }

    /**
     * Atualiza dados da pool de lastro
     */
    async updatePoolData() {
        try {
            // Em produção, buscar do banco de dados
            // Para MVP, usar valores simulados baseados em métricas do app

            // Simular crescimento da pool baseado no uso do app
            const basePool = new BigNumber('1000000'); // R$ 1M inicial
            const growthFactor = 1 + (this.metrics.totalUsers * 0.001); // Crescimento por usuário
            
            this.poolData.totalLiquidity = basePool.multipliedBy(growthFactor);
            
            // Simular revenue diário (0.1% da pool como exemplo)
            this.poolData.dailyRevenue = this.poolData.totalLiquidity.multipliedBy(0.001);
            
            // Calcular taxa de utilização
            this.poolData.utilizationRate = this.brcapyData.totalSupply.dividedBy(this.poolData.totalLiquidity).toNumber();

            this.logger.debug('Pool data updated', {
                totalLiquidity: this.poolData.totalLiquidity.toFixed(2),
                dailyRevenue: this.poolData.dailyRevenue.toFixed(2),
                utilizationRate: (this.poolData.utilizationRate * 100).toFixed(2) + '%'
            });

        } catch (error) {
            this.logger.error('Error updating pool data', {
                error: error.message
            });
        }
    }

    /**
     * Distribui rendimento para todos os usuários
     */
    async distributeYieldToUsers(dailyYield) {
        try {
            let totalDistributed = new BigNumber('0');
            let usersUpdated = 0;

            for (const [userId, userData] of this.userBalances) {
                if (userData.balance.isGreaterThan(0)) {
                    // Calcular rendimento do usuário
                    const userYield = userData.balance.multipliedBy(dailyYield);
                    
                    // Atualizar saldo
                    userData.balance = userData.balance.plus(userYield);
                    userData.lastUpdate = new Date().toISOString();
                    
                    // Adicionar ao histórico do usuário
                    if (!userData.history) {
                        userData.history = [];
                    }
                    
                    userData.history.unshift({
                        date: new Date().toISOString().split('T')[0],
                        type: 'daily_yield',
                        amount: userYield.toFixed(8),
                        balance_after: userData.balance.toFixed(8),
                        yield_rate: dailyYield.multipliedBy(100).toFixed(4) + '%'
                    });

                    // Manter apenas últimos 90 dias de histórico por usuário
                    if (userData.history.length > 90) {
                        userData.history = userData.history.slice(0, 90);
                    }

                    totalDistributed = totalDistributed.plus(userYield);
                    usersUpdated++;
                }
            }

            this.logger.info('Yield distributed to users', {
                totalDistributed: totalDistributed.toFixed(8),
                usersUpdated,
                averageYieldPerUser: usersUpdated > 0 ? totalDistributed.dividedBy(usersUpdated).toFixed(8) : '0'
            });

        } catch (error) {
            this.logger.error('Error distributing yield to users', {
                error: error.message
            });
        }
    }

    /**
     * Atualiza métricas de performance
     */
    async updateMetrics(updateData) {
        try {
            // Calcular APY (Annual Percentage Yield)
            const dailyReturn = updateData.newValue.dividedBy(updateData.previousValue).minus(1);
            const apy = dailyReturn.plus(1).exponentiatedBy(365).minus(1).multipliedBy(100);

            // Atualizar yield médio
            const recentHistory = this.brcapyData.dailyHistory.slice(0, 30); // Últimos 30 dias
            if (recentHistory.length > 0) {
                const totalYield = recentHistory.reduce((sum, day) => sum + parseFloat(day.total_yield), 0);
                this.metrics.averageDailyYield = totalYield / recentHistory.length;
            }

            // Calcular yield cumulativo desde o início
            const initialValue = this.config.initialValue;
            const currentValue = updateData.newValue;
            this.metrics.cumulativeYield = currentValue.dividedBy(initialValue).minus(1).multipliedBy(100).toNumber();

            // Atualizar métricas
            this.metrics.apy = apy.toNumber();
            this.metrics.totalUsers = this.userBalances.size;

            this.logger.debug('Metrics updated', {
                apy: this.metrics.apy.toFixed(2) + '%',
                averageDailyYield: this.metrics.averageDailyYield.toFixed(4) + '%',
                cumulativeYield: this.metrics.cumulativeYield.toFixed(2) + '%',
                totalUsers: this.metrics.totalUsers
            });

        } catch (error) {
            this.logger.error('Error updating metrics', {
                error: error.message
            });
        }
    }

    /**
     * Obtém o valor atual total da BRcapy que um usuário possui
     */
    async getBRcapyValueForUser(userId) {
        try {
            const userData = this.userBalances.get(userId);
            
            if (!userData) {
                return {
                    success: true,
                    data: {
                        userId,
                        balance: '0.00000000',
                        valueInBRL: '0.00',
                        lastUpdate: null,
                        hasBalance: false
                    }
                };
            }

            const currentBRcapyPrice = this.brcapyData.currentValue;
            const userBalance = userData.balance;
            const valueInBRL = userBalance.multipliedBy(currentBRcapyPrice);

            return {
                success: true,
                data: {
                    userId,
                    balance: userBalance.toFixed(8),
                    valueInBRL: valueInBRL.toFixed(2),
                    currentPrice: currentBRcapyPrice.toFixed(8),
                    lastUpdate: userData.lastUpdate,
                    hasBalance: userBalance.isGreaterThan(0),
                    history: userData.history?.slice(0, 10) || [] // Últimas 10 transações
                }
            };

        } catch (error) {
            this.logger.error('Error getting BRcapy value for user', {
                userId,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to get user BRcapy value'
            };
        }
    }

    /**
     * Distribui BRcapy para um usuário (MVP: apenas registro)
     */
    async distributeBRcapy(userId, amount, reason = 'distribution') {
        try {
            const distributionAmount = new BigNumber(amount);
            
            if (distributionAmount.isLessThanOrEqualTo(0)) {
                return {
                    success: false,
                    error: 'Distribution amount must be greater than zero'
                };
            }

            // Obter ou criar dados do usuário
            let userData = this.userBalances.get(userId) || {
                balance: new BigNumber('0'),
                lastUpdate: new Date().toISOString(),
                history: []
            };

            // Atualizar saldo
            userData.balance = userData.balance.plus(distributionAmount);
            userData.lastUpdate = new Date().toISOString();

            // Adicionar ao histórico
            userData.history.unshift({
                date: new Date().toISOString().split('T')[0],
                type: 'distribution',
                amount: distributionAmount.toFixed(8),
                balance_after: userData.balance.toFixed(8),
                reason,
                brcapy_price: this.brcapyData.currentValue.toFixed(8)
            });

            // Salvar dados do usuário
            this.userBalances.set(userId, userData);

            // Atualizar supply total
            this.brcapyData.totalSupply = this.brcapyData.totalSupply.plus(distributionAmount);

            this.logger.info('BRcapy distributed to user', {
                userId,
                amount: distributionAmount.toFixed(8),
                reason,
                newBalance: userData.balance.toFixed(8),
                totalSupply: this.brcapyData.totalSupply.toFixed(8)
            });

            return {
                success: true,
                data: {
                    userId,
                    distributedAmount: distributionAmount.toFixed(8),
                    newBalance: userData.balance.toFixed(8),
                    valueInBRL: userData.balance.multipliedBy(this.brcapyData.currentValue).toFixed(2),
                    reason,
                    timestamp: userData.lastUpdate
                }
            };

        } catch (error) {
            this.logger.error('Error distributing BRcapy', {
                userId,
                amount,
                reason,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to distribute BRcapy'
            };
        }
    }

    /**
     * Resgata BRcapy de um usuário (MVP: apenas registro)
     */
    async redeemBRcapy(userId, amount, targetAsset = 'BRL') {
        try {
            const redeemAmount = new BigNumber(amount);
            
            if (redeemAmount.isLessThanOrEqualTo(0)) {
                return {
                    success: false,
                    error: 'Redeem amount must be greater than zero'
                };
            }

            const userData = this.userBalances.get(userId);
            
            if (!userData || userData.balance.isLessThan(redeemAmount)) {
                return {
                    success: false,
                    error: 'Insufficient BRcapy balance'
                };
            }

            // Calcular valor em BRL
            const currentPrice = this.brcapyData.currentValue;
            const valueInBRL = redeemAmount.multipliedBy(currentPrice);

            // Atualizar saldo do usuário
            userData.balance = userData.balance.minus(redeemAmount);
            userData.lastUpdate = new Date().toISOString();

            // Adicionar ao histórico
            userData.history.unshift({
                date: new Date().toISOString().split('T')[0],
                type: 'redemption',
                amount: `-${redeemAmount.toFixed(8)}`,
                balance_after: userData.balance.toFixed(8),
                value_redeemed: valueInBRL.toFixed(2),
                target_asset: targetAsset,
                brcapy_price: currentPrice.toFixed(8)
            });

            // Salvar dados do usuário
            this.userBalances.set(userId, userData);

            // Atualizar supply total
            this.brcapyData.totalSupply = this.brcapyData.totalSupply.minus(redeemAmount);

            this.logger.info('BRcapy redeemed from user', {
                userId,
                amount: redeemAmount.toFixed(8),
                valueInBRL: valueInBRL.toFixed(2),
                targetAsset,
                newBalance: userData.balance.toFixed(8),
                totalSupply: this.brcapyData.totalSupply.toFixed(8)
            });

            return {
                success: true,
                data: {
                    userId,
                    redeemedAmount: redeemAmount.toFixed(8),
                    valueInBRL: valueInBRL.toFixed(2),
                    newBalance: userData.balance.toFixed(8),
                    targetAsset,
                    timestamp: userData.lastUpdate
                }
            };

        } catch (error) {
            this.logger.error('Error redeeming BRcapy', {
                userId,
                amount,
                targetAsset,
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to redeem BRcapy'
            };
        }
    }

    /**
     * Inicia atualizações periódicas do valor da BRcapy
     */
    startPeriodicUpdates() {
        // Atualização diária às 9h (após abertura do mercado)
        cron.schedule('0 9 * * *', async () => {
            this.logger.info('Starting scheduled BRcapy value update');
            await this.updateBRcapyValue();
        }, {
            timezone: 'America/Sao_Paulo'
        });

        // Atualização de dados da pool a cada hora
        cron.schedule('0 * * * *', async () => {
            await this.updatePoolData();
        });

        this.logger.info('Periodic updates scheduled', {
            dailyUpdate: '09:00 BRT',
            poolUpdate: 'Every hour'
        });
    }

    /**
     * Carrega dados históricos (placeholder para integração com banco)
     */
    async loadHistoricalData() {
        try {
            // Em produção, carregar do banco de dados
            // Para MVP, inicializar com dados padrão
            
            if (this.brcapyData.dailyHistory.length === 0) {
                // Criar histórico inicial dos últimos 30 dias
                const today = new Date();
                let currentValue = this.config.initialValue;
                
                for (let i = 29; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    
                    // Simular crescimento gradual
                    const dailyYield = 0.0004 + (Math.random() * 0.0002); // 0.04% - 0.06% ao dia
                    currentValue = currentValue.multipliedBy(1 + dailyYield);
                    
                    this.brcapyData.dailyHistory.push({
                        date: date.toISOString().split('T')[0],
                        value: currentValue.toFixed(8),
                        cdi_rate: '13.75',
                        internal_rate: (dailyYield * 100 * 0.3).toFixed(4), // 30% do yield vem de taxas internas
                        total_yield: (dailyYield * 100).toFixed(4),
                        pool_value: '1000000.00',
                        daily_revenue: '1000.00'
                    });
                }
                
                // Atualizar valor atual
                this.brcapyData.currentValue = currentValue;
            }

            this.logger.info('Historical data loaded', {
                historyDays: this.brcapyData.dailyHistory.length,
                currentValue: this.brcapyData.currentValue.toFixed(8)
            });

        } catch (error) {
            this.logger.error('Error loading historical data', {
                error: error.message
            });
        }
    }

    /**
     * Obtém dados completos da BRcapy para dashboard
     */
    async getBRcapyDashboardData() {
        try {
            return {
                success: true,
                data: {
                    currentValue: this.brcapyData.currentValue.toFixed(8),
                    lastUpdate: this.brcapyData.lastUpdate,
                    totalSupply: this.brcapyData.totalSupply.toFixed(8),
                    totalPoolValue: this.poolData.totalLiquidity.toFixed(2),
                    metrics: {
                        apy: this.metrics.apy.toFixed(2),
                        averageDailyYield: this.metrics.averageDailyYield.toFixed(4),
                        cumulativeYield: this.metrics.cumulativeYield.toFixed(2),
                        totalUsers: this.metrics.totalUsers
                    },
                    recentHistory: this.brcapyData.dailyHistory.slice(0, 30), // Últimos 30 dias
                    poolData: {
                        totalLiquidity: this.poolData.totalLiquidity.toFixed(2),
                        dailyRevenue: this.poolData.dailyRevenue.toFixed(2),
                        utilizationRate: (this.poolData.utilizationRate * 100).toFixed(2)
                    }
                }
            };

        } catch (error) {
            this.logger.error('Error getting dashboard data', {
                error: error.message
            });

            return {
                success: false,
                error: 'Failed to get dashboard data'
            };
        }
    }

    /**
     * Força atualização manual (para testes/admin)
     */
    async forceUpdate() {
        this.logger.info('Forcing BRcapy value update');
        return await this.updateBRcapyValue();
    }

    /**
     * Obtém métricas do sistema
     */
    getSystemMetrics() {
        return {
            brcapy: {
                currentValue: this.brcapyData.currentValue.toFixed(8),
                totalSupply: this.brcapyData.totalSupply.toFixed(8),
                lastUpdate: this.brcapyData.lastUpdate
            },
            pool: {
                totalLiquidity: this.poolData.totalLiquidity.toFixed(2),
                dailyRevenue: this.poolData.dailyRevenue.toFixed(2),
                utilizationRate: this.poolData.utilizationRate
            },
            metrics: this.metrics,
            users: {
                total: this.userBalances.size,
                withBalance: Array.from(this.userBalances.values()).filter(u => u.balance.isGreaterThan(0)).length
            }
        };
    }
}

module.exports = BRcapyService; 