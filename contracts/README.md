# 🐹 Capy Pay Smart Contracts

Este repositório contém os smart contracts para o sistema Capy Pay, implementados em Solidity e testados com Foundry.

## 📁 Estrutura do Projeto

```
contracts/
├── src/                    # Smart contracts
│   ├── CapyCoin.sol       # Token ERC-20 de utilidade
│   ├── BRcapy.sol         # Yieldcoin com lógica de valorização
│   └── interfaces/        # Interfaces dos contratos
├── test/                  # Testes em Solidity
│   ├── CapyCoin.t.sol     # Testes do CapyCoin
│   ├── BRcapy.t.sol       # Testes do BRcapy
│   └── utils/             # Utilitários para testes
├── script/                # Scripts de deployment
│   ├── Deploy.s.sol       # Script principal de deploy
│   └── utils/             # Utilitários de deployment
├── lib/                   # Dependências (git submodules)
├── out/                   # Artifacts compilados
├── cache/                 # Cache do compilador
├── broadcast/             # Logs de deployment
└── foundry.toml          # Configuração do Foundry
```

## 🛠️ Setup Inicial

### 1. Instalar Foundry
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Instalar Dependências
```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
```

### 3. Configurar Variáveis de Ambiente
```bash
cp .env.example .env
# Editar .env com suas chaves privadas e endpoints
```

### 4. Compilar Contratos
```bash
forge build
```

## 🧪 Executar Testes

### Todos os Testes
```bash
forge test
```

### Testes com Verbosidade
```bash
forge test -vvv
```

### Testes Específicos
```bash
forge test --match-contract CapyCoinTest
forge test --match-test testMint
```

### Coverage de Testes
```bash
forge coverage
```

## 🚀 Deploy

### Deploy na Base Testnet (Sepolia)
```bash
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
```

### Deploy na Base Mainnet
```bash
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
```

## 📊 Gas Report
```bash
forge test --gas-report
```

## 🔍 Verificação de Contratos
```bash
forge verify-contract <contract_address> src/CapyCoin.sol:CapyCoin --chain base
```

## 🌐 Redes Suportadas

- **Base Mainnet**: Chain ID 8453
- **Base Sepolia**: Chain ID 84532 (Testnet)

## 🔧 Comandos Úteis

```bash
# Formatar código
forge fmt

# Análise de gas
forge snapshot

# Verificar sintaxe
forge check

# Limpar cache
forge clean

# Atualizar dependências
forge update
```

## 📝 Contratos

### CapyCoin (CAPY)
- **Tipo**: ERC-20 Token de Utilidade
- **Decimais**: 18
- **Funcionalidades**: 
  - Mintagem controlada pelo backend
  - Transferências padrão ERC-20
  - Queima de tokens

### BRcapy (BRCAPY)
- **Tipo**: ERC-20 Yieldcoin
- **Decimais**: 18
- **Funcionalidades**:
  - Valor dinâmico atualizado pelo backend
  - Mintagem/queima proporcional ao valor atual
  - Cálculo de yield baseado em CDI + taxas

## 🔐 Segurança

- Contratos auditados para vulnerabilidades comuns
- Uso de OpenZeppelin para padrões seguros
- Testes extensivos com Foundry
- Controle de acesso baseado em roles

## 📄 Licença

MIT License 