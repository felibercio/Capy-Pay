# 🔨 Foundry Guide - Capy Pay Smart Contracts

Este guia completo mostra como usar o Foundry para desenvolver, testar e fazer deploy dos smart contracts do Capy Pay.

## 📋 Índice

1. [Instalação e Setup](#instalação-e-setup)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Compilação](#compilação)
4. [Testes](#testes)
5. [Deployment](#deployment)
6. [Verificação de Contratos](#verificação-de-contratos)
7. [Interação com Contratos](#interação-com-contratos)
8. [Debugging e Análise](#debugging-e-análise)
9. [Comandos Avançados](#comandos-avançados)
10. [Troubleshooting](#troubleshooting)

---

## 🚀 Instalação e Setup

### 1. Instalar Foundry

```bash
# Instalar Foundry
curl -L https://foundry.paradigm.xyz | bash

# Atualizar PATH (reiniciar terminal ou executar)
source ~/.bashrc

# Atualizar para versão mais recente
foundryup
```

### 2. Verificar Instalação

```bash
# Verificar versões dos componentes
forge --version
cast --version
anvil --version
chisel --version
```

### 3. Inicializar Projeto

```bash
# Clonar/navegar para o diretório do projeto
cd contracts/

# Instalar dependências
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std

# Verificar instalação
forge build
```

### 4. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env com suas configurações
nano .env
```

Exemplo de `.env`:
```bash
# Private key (sem prefixo 0x)
PRIVATE_KEY=your_private_key_here

# RPC URLs
BASE_RPC_URL=https://mainnet.base.org
BASE_TESTNET_RPC_URL=https://sepolia.base.org

# API Keys
BASESCAN_API_KEY=your_basescan_api_key

# Contract addresses
BACKEND_MINTER_ADDRESS=0x742d35Cc6634C0532925a3b8D404d521AC7bd11f
BACKEND_UPDATER_ADDRESS=0x742d35Cc6634C0532925a3b8D404d521AC7bd11f
```

---

## 📁 Estrutura do Projeto

```
contracts/
├── foundry.toml          # Configuração do Foundry
├── .env.example          # Exemplo de variáveis de ambiente
├── README.md             # Documentação principal
├── FOUNDRY_GUIDE.md      # Este guia
├── remappings.txt        # Mapeamentos de imports (auto-gerado)
│
├── src/                  # Smart contracts
│   ├── CapyCoin.sol      # Token ERC-20 de utilidade
│   ├── BRcapy.sol        # Yieldcoin com lógica de valorização
│   └── interfaces/       # Interfaces dos contratos
│
├── test/                 # Testes em Solidity
│   ├── CapyCoin.t.sol    # Testes do CapyCoin
│   ├── BRcapy.t.sol      # Testes do BRcapy
│   └── utils/            # Utilitários para testes
│
├── script/               # Scripts de deployment
│   ├── Deploy.s.sol      # Script principal de deploy
│   └── utils/            # Utilitários de deployment
│
├── lib/                  # Dependências (git submodules)
│   ├── forge-std/        # Biblioteca padrão do Foundry
│   └── openzeppelin-contracts/  # OpenZeppelin
│
├── out/                  # Artifacts compilados
├── cache/                # Cache do compilador
└── broadcast/            # Logs de deployment
```

---

## ⚙️ Compilação

### Comandos Básicos

```bash
# Compilar todos os contratos
forge build

# Compilar com otimizações específicas
forge build --optimize --optimizer-runs 200

# Compilar apenas contratos alterados
forge build --force

# Compilar com perfil específico
FOUNDRY_PROFILE=production forge build
```

### Verificar Sintaxe

```bash
# Verificar sintaxe sem compilar
forge check

# Formatar código
forge fmt

# Verificar formatação
forge fmt --check
```

### Limpar Cache

```bash
# Limpar cache e artifacts
forge clean

# Limpar apenas cache
forge clean --cache
```

---

## 🧪 Testes

### Executar Testes

```bash
# Executar todos os testes
forge test

# Executar com verbosidade
forge test -v          # Básica
forge test -vv         # Média  
forge test -vvv        # Alta
forge test -vvvv       # Máxima (incluindo traces)

# Executar testes específicos
forge test --match-contract CapyCoinTest
forge test --match-test testMint
forge test --match-path test/CapyCoin.t.sol

# Executar testes com filtros
forge test --match-contract CapyCoin --match-test mint
```

### Testes Avançados

```bash
# Executar com gas report
forge test --gas-report

# Executar fuzz tests com mais runs
forge test --fuzz-runs 10000

# Executar invariant tests
forge test --invariant-runs 1000

# Executar com coverage
forge coverage
forge coverage --report lcov
```

### Debugging de Testes

```bash
# Executar teste específico com trace completo
forge test --match-test testMint -vvvv

# Debug interativo
forge debug --match-test testMint

# Executar com breakpoints
forge test --match-test testMint --debug
```

### Testes em Fork

```bash
# Testar em fork da mainnet
forge test --fork-url $BASE_RPC_URL

# Testar em fork de bloco específico
forge test --fork-url $BASE_RPC_URL --fork-block-number 5000000

# Testar em fork com estado específico
forge test --fork-url $BASE_RPC_URL --fork-block-number latest
```

---

## 🚀 Deployment

### Deploy Local (Anvil)

```bash
# Terminal 1: Iniciar Anvil (blockchain local)
anvil

# Terminal 2: Deploy nos contratos
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Deploy em Testnet (Base Sepolia)

```bash
# Deploy simples
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast

# Deploy com verificação
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify

# Deploy específico para testnet
forge script script/Deploy.s.sol:DeployTestnet --rpc-url base_sepolia --broadcast --verify

# Deploy com confirmações extras
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify --etherscan-api-key $BASESCAN_API_KEY
```

### Deploy em Mainnet (Base)

```bash
# Deploy em mainnet (CUIDADO!)
forge script script/Deploy.s.sol:DeployMainnet --rpc-url base --broadcast --verify --etherscan-api-key $BASESCAN_API_KEY

# Simular deploy antes de executar
forge script script/Deploy.s.sol:DeployMainnet --rpc-url base

# Deploy com gas limit específico
forge script script/Deploy.s.sol --rpc-url base --broadcast --gas-limit 5000000
```

### Verificar Deployment

```bash
# Verificar se deployment foi bem-sucedido
cast code <contract_address> --rpc-url base_sepolia

# Obter informações do contrato
cast call <contract_address> "name()" --rpc-url base_sepolia
cast call <contract_address> "symbol()" --rpc-url base_sepolia
cast call <contract_address> "totalSupply()" --rpc-url base_sepolia
```

---

## ✅ Verificação de Contratos

### Verificação Automática

```bash
# Verificar durante o deploy
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify

# Verificar contrato específico
forge verify-contract <contract_address> src/CapyCoin.sol:CapyCoin --chain base-sepolia --etherscan-api-key $BASESCAN_API_KEY

# Verificar com constructor args
forge verify-contract <contract_address> src/BRcapy.sol:BRcapy --chain base-sepolia --constructor-args $(cast abi-encode "constructor(uint256,uint256,uint256,address,address)" 1052345670000000000 1175 110 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f)
```

### Verificação Manual

```bash
# Obter bytecode do contrato
forge inspect CapyCoin bytecode

# Verificar no Basescan manualmente
# 1. Ir para https://sepolia.basescan.org/address/<contract_address>
# 2. Clicar em "Contract" -> "Verify and Publish"
# 3. Selecionar "Via Standard JSON Input"
# 4. Upload do arquivo JSON gerado por: forge verify-contract --show-standard-json-input
```

---

## 🔧 Interação com Contratos

### Leitura de Dados

```bash
# Informações básicas do token
cast call $CAPY_ADDRESS "name()" --rpc-url base_sepolia
cast call $CAPY_ADDRESS "symbol()" --rpc-url base_sepolia
cast call $CAPY_ADDRESS "totalSupply()" --rpc-url base_sepolia
cast call $CAPY_ADDRESS "decimals()" --rpc-url base_sepolia

# Saldo de um endereço
cast call $CAPY_ADDRESS "balanceOf(address)" 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f --rpc-url base_sepolia

# Informações da BRcapy
cast call $BRCAPY_ADDRESS "currentValue()" --rpc-url base_sepolia
cast call $BRCAPY_ADDRESS "cdiRate()" --rpc-url base_sepolia
cast call $BRCAPY_ADDRESS "currentAPY()" --rpc-url base_sepolia

# Conversões
cast call $BRCAPY_ADDRESS "tokensToBRL(uint256)" 1000000000000000000 --rpc-url base_sepolia
cast call $BRCAPY_ADDRESS "brlToTokens(uint256)" 1000000000000000000 --rpc-url base_sepolia
```

### Escrita de Dados

```bash
# Mint CapyCoin (como minter)
cast send $CAPY_ADDRESS "mint(address,uint256)" 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f 1000000000000000000000 --rpc-url base_sepolia --private-key $PRIVATE_KEY

# Transferir tokens
cast send $CAPY_ADDRESS "transfer(address,uint256)" 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f 1000000000000000000 --rpc-url base_sepolia --private-key $PRIVATE_KEY

# Atualizar valor da BRcapy (como updater)
cast send $BRCAPY_ADDRESS "updateValue(uint256,uint256,uint256)" 1060000000000000000 1200 115 --rpc-url base_sepolia --private-key $PRIVATE_KEY

# Mint BRcapy baseado em BRL
cast send $BRCAPY_ADDRESS "mintFromBRL(address,uint256)" 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f 1000000000000000000000 --rpc-url base_sepolia --private-key $PRIVATE_KEY
```

### Monitoramento de Eventos

```bash
# Monitorar eventos de Transfer
cast logs --from-block latest --to-block latest --address $CAPY_ADDRESS "Transfer(address,address,uint256)" --rpc-url base_sepolia

# Monitorar eventos de ValueUpdated
cast logs --from-block latest --to-block latest --address $BRCAPY_ADDRESS "ValueUpdated(uint256,uint256,uint256,uint256,uint256,uint256,address)" --rpc-url base_sepolia
```

---

## 🐛 Debugging e Análise

### Gas Analysis

```bash
# Relatório de gas para testes
forge test --gas-report

# Snapshot de gas (para comparação)
forge snapshot

# Comparar snapshots
forge snapshot --diff .gas-snapshot

# Gas estimation para função específica
cast estimate $CONTRACT_ADDRESS "mint(address,uint256)" 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f 1000000000000000000 --rpc-url base_sepolia
```

### Storage Analysis

```bash
# Analisar layout de storage
forge inspect CapyCoin storageLayout

# Ler storage slot específico
cast storage $CONTRACT_ADDRESS 0 --rpc-url base_sepolia

# Analisar mudanças de storage
forge test --debug --match-test testMint
```

### Trace Analysis

```bash
# Trace de transação
cast run <transaction_hash> --rpc-url base_sepolia

# Debug interativo
chisel

# Dentro do chisel:
# !load src/CapyCoin.sol
# CapyCoin token = new CapyCoin(address(1), address(2));
```

### Security Analysis

```bash
# Análise estática (requer slither)
slither .

# Verificar padrões comuns
forge test --match-test invariant

# Análise de reentrância
forge test --match-test testReentrancy -vvvv
```

---

## 🔬 Comandos Avançados

### Forge Advanced

```bash
# Executar com perfil específico
FOUNDRY_PROFILE=ci forge test

# Executar testes com seed específico
forge test --fuzz-seed 0x123

# Executar com timeout customizado
forge test --timeout 60

# Gerar documentação
forge doc --build

# Executar com diferentes versões do Solidity
forge build --use solc:0.8.24
```

### Cast Advanced

```bash
# Converter entre formatos
cast --to-hex 1000000000000000000
cast --from-wei 1000000000000000000
cast --to-wei 1 ether

# Calcular keccak256
cast keccak "mint(address,uint256)"

# Gerar endereços
cast wallet new
cast wallet address --private-key $PRIVATE_KEY

# Calcular endereço de contrato
cast compute-address 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f --nonce 1

# Decodificar calldata
cast --calldata-decode "mint(address,uint256)" 0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d404d521ac7bd11f0000000000000000000000000000000000000000000000000de0b6b3a7640000
```

### Anvil Advanced

```bash
# Iniciar com configurações específicas
anvil --accounts 20 --balance 10000 --gas-limit 30000000

# Fork de rede específica
anvil --fork-url $BASE_RPC_URL --fork-block-number 5000000

# Configurar gas price
anvil --gas-price 1000000000

# Configurar base fee
anvil --base-fee 1000000000
```

---

## 📊 Exemplos de Workflow Completo

### Desenvolvimento Local

```bash
# 1. Setup inicial
forge install
forge build

# 2. Desenvolvimento iterativo
forge test --watch  # Executa testes automaticamente quando arquivos mudam

# 3. Testes específicos
forge test --match-contract CapyCoinTest -v

# 4. Deploy local
anvil &  # Em terminal separado
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# 5. Interação local
export CAPY_ADDRESS=0x...  # Endereço do deploy
cast call $CAPY_ADDRESS "name()" --rpc-url http://localhost:8545
```

### Deploy em Testnet

```bash
# 1. Preparação
forge build
forge test

# 2. Simulação
forge script script/Deploy.s.sol --rpc-url base_sepolia

# 3. Deploy real
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify

# 4. Verificação
cast call <deployed_address> "name()" --rpc-url base_sepolia

# 5. Testes de integração
forge test --fork-url base_sepolia --match-test testIntegration
```

### Deploy em Mainnet

```bash
# 1. Testes finais
forge test
forge coverage

# 2. Auditoria de gas
forge test --gas-report
forge snapshot

# 3. Simulação de mainnet
forge script script/Deploy.s.sol:DeployMainnet --rpc-url base

# 4. Deploy real (CUIDADO!)
forge script script/Deploy.s.sol:DeployMainnet --rpc-url base --broadcast --verify

# 5. Verificação pós-deploy
cast call <deployed_address> "name()" --rpc-url base
```

---

## 🔧 Configurações Úteis

### foundry.toml Personalizado

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
gas_reports = ["*"]

[profile.ci]
fuzz = { runs = 10000 }
invariant = { runs = 1000 }

[profile.production]
optimizer = true
optimizer_runs = 1000000
via_ir = true

[rpc_endpoints]
base = "${BASE_RPC_URL}"
base_sepolia = "${BASE_TESTNET_RPC_URL}"
```

### Aliases Úteis (.bashrc)

```bash
# Aliases para Foundry
alias fb='forge build'
alias ft='forge test'
alias ftv='forge test -vvv'
alias fc='forge clean'
alias ff='forge fmt'

# Aliases para Cast
alias cb='cast balance'
alias cc='cast call'
alias cs='cast send'

# Aliases específicos do projeto
alias deploy-local='forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast'
alias deploy-testnet='forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify'
```

---

## ❗ Troubleshooting

### Problemas Comuns

#### 1. Erro de Compilação
```bash
# Problema: "Compiler version not found"
# Solução:
foundryup
forge build --use solc:0.8.24
```

#### 2. Erro de Dependências
```bash
# Problema: "Library not found"
# Solução:
forge install
forge update
```

#### 3. Erro de RPC
```bash
# Problema: "RPC endpoint not responding"
# Solução:
# Verificar .env
# Testar conectividade:
cast chain-id --rpc-url $BASE_RPC_URL
```

#### 4. Erro de Gas
```bash
# Problema: "Out of gas"
# Solução:
forge script script/Deploy.s.sol --gas-limit 5000000 --rpc-url base_sepolia --broadcast
```

#### 5. Erro de Verificação
```bash
# Problema: "Verification failed"
# Solução:
# Aguardar alguns minutos e tentar novamente
forge verify-contract <address> src/Contract.sol:Contract --chain base-sepolia --etherscan-api-key $BASESCAN_API_KEY --watch
```

### Debug Avançado

```bash
# 1. Verificar configuração
forge config

# 2. Verificar dependências
forge tree

# 3. Verificar remappings
cat remappings.txt

# 4. Limpar tudo e recompilar
forge clean
rm -rf lib/
forge install
forge build

# 5. Verificar bytecode
forge inspect Contract bytecode
```

### Logs e Monitoramento

```bash
# Logs detalhados
forge test -vvvv 2>&1 | tee test.log

# Monitoramento contínuo
watch -n 5 'cast balance $MY_ADDRESS --rpc-url base_sepolia'

# Verificar eventos recentes
cast logs --from-block -100 --address $CONTRACT_ADDRESS --rpc-url base_sepolia
```

---

## 📚 Recursos Adicionais

### Documentação Oficial
- [Foundry Book](https://book.getfoundry.sh/)
- [Foundry GitHub](https://github.com/foundry-rs/foundry)
- [Base Network Docs](https://docs.base.org/)

### Ferramentas Complementares
- [Basescan](https://basescan.org/) - Explorer da Base
- [Tenderly](https://tenderly.co/) - Debugging e simulação
- [OpenZeppelin Wizard](https://wizard.openzeppelin.com/) - Gerador de contratos

### Scripts Úteis
```bash
# Script para monitoramento contínuo
#!/bin/bash
# monitor.sh
while true; do
    echo "=== $(date) ==="
    cast call $BRCAPY_ADDRESS "currentValue()" --rpc-url base_sepolia
    sleep 300  # 5 minutos
done
```

---

## 🎯 Checklist de Deploy

### Pré-Deploy
- [ ] Todos os testes passando
- [ ] Coverage > 90%
- [ ] Gas report analisado
- [ ] Configurações verificadas
- [ ] Endereços do backend confirmados
- [ ] Variáveis de ambiente configuradas

### Durante Deploy
- [ ] Simulação executada com sucesso
- [ ] Gas suficiente na carteira
- [ ] Deploy executado
- [ ] Contratos verificados
- [ ] Endereços salvos

### Pós-Deploy
- [ ] Funcionalidades básicas testadas
- [ ] Roles configuradas corretamente
- [ ] Backend integrado
- [ ] Monitoramento configurado
- [ ] Documentação atualizada

---

**🐹 Agora você está pronto para usar o Foundry com os contratos do Capy Pay! Para dúvidas específicas, consulte a [documentação oficial do Foundry](https://book.getfoundry.sh/) ou abra uma issue no repositório.** 