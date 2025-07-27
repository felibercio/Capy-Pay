# 📄 Integração do Smart Contract CapyCoin

## 📋 Visão Geral

Esta pasta contém todos os arquivos necessários para integração do smart contract CapyCoin com o frontend do Capy Pay.

## 🏗️ Estrutura

```
src/contracts/
├── CapyCoin.json       # ABI do contrato
├── config.ts           # Configurações do contrato
├── capyCoinService.ts  # Serviço de interação
└── README.md          # Esta documentação
```

## 🎮 Modo de Operação

O sistema opera em dois modos:

### 1. **Modo Simulação** (Padrão)
- Sem necessidade de blockchain real
- Dados armazenados em memória
- Perfeito para desenvolvimento e demonstrações
- Zero custos de gas

### 2. **Modo Blockchain** (Futuro)
- Integração com Base Sepolia/Mainnet
- Transações reais na blockchain
- Requer carteira conectada
- Custos de gas aplicáveis

## 🔧 Configuração

### Ativar Modo Simulação (Padrão)
```typescript
// src/contracts/config.ts
export const CONTRACT_CONFIG = {
  address: null, // null = modo simulação
  simulationMode: true
};
```

### Ativar Modo Blockchain
```typescript
// src/contracts/config.ts
export const CONTRACT_CONFIG = {
  address: '0x...', // endereço do contrato deployado
  simulationMode: false
};
```

## 📱 Como Usar

### Importar o Serviço
```typescript
import { capyCoinService } from '@/contracts/capyCoinService';
```

### Verificar Informações do Token
```typescript
const tokenInfo = await capyCoinService.getTokenInfo();
console.log(tokenInfo);
// {
//   name: 'Capy Coin',
//   symbol: 'CAPY',
//   totalSupply: '1000000',
//   maxSupply: '100000000'
// }
```

### Obter Informações do Usuário
```typescript
const userInfo = await capyCoinService.getUserInfo('0x...');
console.log(userInfo);
// {
//   active: true,
//   balance: '1000',
//   totalRewards: '50',
//   canClaim: true,
//   nextRewardIn: 0
// }
```

### Reivindicar Recompensa Diária
```typescript
try {
  await capyCoinService.claimDailyReward('0x...');
  console.log('Recompensa reivindicada!');
} catch (error) {
  console.error('Erro:', error.message);
}
```

### Transferir Tokens
```typescript
await capyCoinService.transfer(
  '0x...', // de
  '0x...', // para
  '100'    // quantidade
);
```

## 🚀 Deploy do Contrato

Se quiser fazer deploy real:

1. **Navegue para a pasta contracts/**
   ```bash
   cd contracts
   ```

2. **Configure o .env**
   ```bash
   PRIVATE_KEY=sua_chave_privada
   ```

3. **Faça o deploy**
   ```bash
   forge script script/DeploySimple.s.sol --rpc-url https://sepolia.base.org --broadcast
   ```

4. **Atualize config.ts**
   ```typescript
   address: '0x_endereco_do_contrato_deployado'
   ```

## ⚡ Funcionalidades Disponíveis

- ✅ Consultar saldo
- ✅ Transferir tokens
- ✅ Reivindicar recompensa diária
- ✅ Verificar informações do usuário
- ✅ Estatísticas do token
- ✅ Mint (apenas owner)

## 🔒 Segurança

- Modo simulação não persiste dados
- Nenhuma chave privada é armazenada
- Transações simuladas são seguras
- Sem risco de perda de fundos

## 📝 Notas

- O modo simulação é reiniciado quando a página recarrega
- Perfeito para demonstrações e desenvolvimento
- Migração para blockchain real é simples (apenas mudar config)
- Totalmente compatível com o frontend existente 