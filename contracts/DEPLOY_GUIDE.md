# 🚀 Guia de Deploy - CapyCoin Híbrido

Este guia fornece instruções detalhadas para fazer o deploy do contrato CapyCoin Híbrido na rede Base.

## 📋 Pré-requisitos

1. **Foundry instalado**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Node.js e NPM**
   ```bash
   node --version  # v18+
   npm --version   # v9+
   ```

3. **Carteira com ETH**
   - Para testnet: ETH na Base Sepolia
   - Para mainnet: ETH na Base

## 🔧 Configuração

### 1. Instalar Dependências

```bash
cd contracts
forge install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na pasta `contracts/`:

```bash
# Chave privada da carteira (NUNCA compartilhe!)
PRIVATE_KEY=0x...

# URLs RPC
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org

# Endereço do backend que fará mint
BACKEND_MINTER_ADDRESS=0x...

# API Key do Basescan para verificação
ETHERSCAN_API_KEY=...

# Deploy BRcapy também? (opcional)
DEPLOY_BRCAPY=false
```

### 3. Obter ETH de Teste (Base Sepolia)

1. Acesse: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
2. Conecte sua carteira
3. Solicite ETH de teste

## 🚀 Deploy

### Deploy na Base Sepolia (Testnet)

1. **Compilar o contrato:**
   ```bash
   forge build
   ```

2. **Testar o deploy (simulação):**
   ```bash
   forge script script/DeployHybrid.s.sol:DeployHybrid --rpc-url base_sepolia
   ```

3. **Deploy real:**
   ```bash
   forge script script/DeployHybrid.s.sol:DeployHybrid \
     --rpc-url base_sepolia \
     --broadcast \
     --verify \
     --etherscan-api-key $ETHERSCAN_API_KEY
   ```

### Deploy na Base Mainnet

⚠️ **ATENÇÃO**: Este é um deploy em produção!

```bash
forge script script/DeployHybrid.s.sol:DeployHybrid \
  --rpc-url base \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## 📊 Verificação Pós-Deploy

### 1. Verificar no Basescan

- **Testnet**: https://sepolia.basescan.org/address/SEU_ENDERECO_AQUI
- **Mainnet**: https://basescan.org/address/SEU_ENDERECO_AQUI

### 2. Testar Funcionalidades

```bash
# Verificar se pode mintar
cast call SEU_CONTRATO "canMint(address)" SEU_ENDERECO --rpc-url base_sepolia

# Ver supply total
cast call SEU_CONTRATO "totalSupply()" --rpc-url base_sepolia

# Ver informações do token
cast call SEU_CONTRATO "tokenInfo()" --rpc-url base_sepolia
```

### 3. Interagir com o Contrato

```bash
# Mint de tokens (apenas backend)
cast send SEU_CONTRATO "mint(address,uint256)" ENDERECO_DESTINO 1000000000000000000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url base_sepolia

# Registrar referral
cast send SEU_CONTRATO "registerReferral(address)" ENDERECO_REFERRER \
  --private-key $PRIVATE_KEY \
  --rpc-url base_sepolia
```

## 🔄 Integração com Frontend

1. **Copiar o endereço do contrato** do output do deploy

2. **Atualizar o frontend:**
   ```typescript
   // src/constants/contracts.ts
   export const CAPYCOIN_ADDRESS = "0x..."; // Endereço do deploy
   ```

3. **Copiar ABI:**
   ```bash
   forge inspect CapyCoinHybrid abi > ../src/contracts/CapyCoin.json
   ```

## 📝 Checklist Pós-Deploy

- [ ] Contrato deployado com sucesso
- [ ] Verificado no Basescan
- [ ] Roles configurados corretamente
- [ ] Backend tem role de MINTER
- [ ] Admin tem roles de controle
- [ ] Mint inicial realizado (se testnet)
- [ ] Frontend atualizado com endereço
- [ ] ABI copiado para frontend
- [ ] Testes básicos realizados

## 🛠️ Troubleshooting

### Erro: "Insufficient funds"
- Verifique se tem ETH suficiente na carteira
- Para testnet, use o faucet

### Erro: "Nonce too low"
- Reset nonce: `cast nonce SEU_ENDERECO --rpc-url base_sepolia`

### Erro na verificação
- Certifique-se que a API key do Basescan está correta
- Tente verificar manualmente:
  ```bash
  forge verify-contract \
    --chain-id 84532 \
    --compiler-version v0.8.24 \
    ENDERECO_CONTRATO \
    src/CapyCoinHybrid.sol:CapyCoinHybrid \
    --etherscan-api-key $ETHERSCAN_API_KEY
  ```

## 📞 Suporte

Em caso de dúvidas:
1. Revise os logs do deploy
2. Verifique as transações no Basescan
3. Consulte a documentação do Foundry

## 🎉 Próximos Passos

Após o deploy bem-sucedido:

1. **Testar todas as funcionalidades**
   - Sistema de recompensas
   - Programa de referral
   - Staking e unstaking
   - Sistema de níveis

2. **Configurar monitoramento**
   - Alertas para eventos importantes
   - Dashboard de métricas

3. **Preparar documentação**
   - Para usuários
   - Para desenvolvedores
   - Para o backend

Parabéns! Seu CapyCoin Híbrido está pronto! 🚀 