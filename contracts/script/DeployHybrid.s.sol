// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CapyCoinHybrid.sol";
import "../src/BRcapy.sol";

/**
 * @title DeployHybrid
 * @dev Script para deployment do CapyCoin Híbrido na rede Base
 * 
 * Como usar:
 * 
 * 1. Base Sepolia (Testnet):
 * forge script script/DeployHybrid.s.sol:DeployHybrid --rpc-url base_sepolia --broadcast --verify
 * 
 * 2. Base Mainnet:
 * forge script script/DeployHybrid.s.sol:DeployHybrid --rpc-url base --broadcast --verify
 * 
 * 3. Simulação local:
 * forge script script/DeployHybrid.s.sol:DeployHybrid
 */
contract DeployHybrid is Script {
    // ==========================================
    // CONFIGURATION
    // ==========================================
    
    // Endereços do backend (obtidos das variáveis de ambiente)
    address public backendMinter;
    address public admin;
    
    // Contratos deployados
    CapyCoinHybrid public capyCoin;
    BRcapy public brcapy;
    
    // Configurações iniciais da BRcapy
    uint256 public constant INITIAL_BRCAPY_VALUE = 1.05234567 * 10**18; // 1.05234567 BRL
    uint256 public constant INITIAL_CDI_RATE = 1175; // 11.75%
    uint256 public constant INITIAL_INTERNAL_FEE = 110; // 1.10%

    // ==========================================
    // SETUP
    // ==========================================
    
    function setUp() public {
        // Obter endereços das variáveis de ambiente
        backendMinter = vm.envOr("BACKEND_MINTER_ADDRESS", address(0));
        
        // Se não fornecido, usar endereço padrão para teste
        if (backendMinter == address(0)) {
            backendMinter = 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f;
            console.log("WARNING: Using default backend minter address");
        }
        
        // Admin será o deployer por padrão
        admin = msg.sender;
        
        console.log("=== DEPLOYMENT CONFIGURATION ===");
        console.log("Backend Minter:", backendMinter);
        console.log("Admin:", admin);
        console.log("Chain ID:", block.chainid);
        console.log("Deployer Balance:", msg.sender.balance / 1e18, "ETH");
    }

    // ==========================================
    // MAIN DEPLOYMENT FUNCTION
    // ==========================================
    
    function run() public {
        // Validar configuração
        validateConfiguration();
        
        // Obter private key para deploy
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Iniciar broadcast das transações
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("\n=== STARTING DEPLOYMENT ===");
        console.log("Deployer:", msg.sender);
        console.log("Timestamp:", block.timestamp);
        
        // Deploy CapyCoin Híbrido
        deployCapyCoinHybrid();
        
        // Deploy BRcapy (opcional)
        if (shouldDeployBRcapy()) {
            deployBRcapy();
        }
        
        // Configurações pós-deployment
        postDeploymentSetup();
        
        // Finalizar broadcast
        vm.stopBroadcast();
        
        // Exibir resumo
        printDeploymentSummary();
    }

    // ==========================================
    // DEPLOYMENT FUNCTIONS
    // ==========================================
    
    function deployCapyCoinHybrid() internal {
        console.log("\n--- Deploying CapyCoin Hybrid ---");
        
        // Deploy do contrato
        capyCoin = new CapyCoinHybrid(backendMinter, admin);
        
        console.log("CapyCoin Hybrid deployed at:", address(capyCoin));
        console.log("Name:", capyCoin.name());
        console.log("Symbol:", capyCoin.symbol());
        console.log("Decimals:", capyCoin.decimals());
        console.log("Max Supply:", capyCoin.MAX_SUPPLY() / 1e18, "CAPY");
        console.log("Backend Minter:", capyCoin.backendMinter());
        
        // Verificar roles
        require(capyCoin.hasRole(capyCoin.DEFAULT_ADMIN_ROLE(), admin), "Admin role not set");
        require(capyCoin.hasRole(capyCoin.MINTER_ROLE(), backendMinter), "Minter role not set");
        require(capyCoin.hasRole(capyCoin.PAUSER_ROLE(), admin), "Pauser role not set");
        require(capyCoin.hasRole(capyCoin.REWARDS_MANAGER_ROLE(), admin), "Rewards manager role not set");
        require(capyCoin.hasRole(capyCoin.REWARDS_MANAGER_ROLE(), backendMinter), "Backend rewards role not set");
        
        console.log("✓ CapyCoin Hybrid roles configured correctly");
        
        // Verificar configurações de recompensas
        console.log("\n--- Rewards Configuration ---");
        console.log("Transaction Reward:", capyCoin.activityRewards(0) / 1e18, "CAPY");
        console.log("Referral Reward:", capyCoin.activityRewards(1) / 1e18, "CAPY");
        console.log("Staking Daily Reward:", capyCoin.activityRewards(2) / 1e18, "CAPY");
        console.log("Daily Login Reward:", capyCoin.activityRewards(3) / 1e18, "CAPY");
        console.log("Level Up Reward:", capyCoin.activityRewards(4) / 1e18, "CAPY");
    }
    
    function deployBRcapy() internal {
        console.log("\n--- Deploying BRcapy ---");
        
        // Deploy do contrato
        brcapy = new BRcapy(
            INITIAL_BRCAPY_VALUE,
            INITIAL_CDI_RATE,
            INITIAL_INTERNAL_FEE,
            backendMinter,
            admin
        );
        
        console.log("BRcapy deployed at:", address(brcapy));
        console.log("Initial Value:", brcapy.currentValue() / 1e18, "BRL");
        console.log("✓ BRcapy deployed successfully");
    }
    
    function postDeploymentSetup() internal {
        console.log("\n--- Post-Deployment Setup ---");
        
        // Verificar funcionalidades básicas
        testBasicFunctionality();
        
        // Em testnet, fazer mint inicial para testes
        if (isTestnet() && msg.sender == admin) {
            console.log("Minting initial tokens for testing...");
            capyCoin.mint(msg.sender, 10000 * 10**18); // 10k CAPY para testes
            console.log("✓ Minted 10,000 CAPY for testing");
        }
        
        console.log("✓ Post-deployment setup completed");
    }
    
    function testBasicFunctionality() internal view {
        console.log("Testing basic functionality...");
        
        // Teste CapyCoin - verificar se pode mintar
        assertTrue(capyCoin.canMint(backendMinter), "Backend cannot mint CAPY");
        assertFalse(capyCoin.canMint(address(0x123)), "Random address can mint CAPY");
        
        // Verificar níveis
        (uint256 level, uint256 points, uint256 toNext, string memory levelName) = capyCoin.getLevelInfo(admin);
        console.log("Admin Level:", levelName);
        console.log("Admin Points:", points);
        
        console.log("✓ Basic functionality tests passed");
    }

    // ==========================================
    // VALIDATION AND HELPERS
    // ==========================================
    
    function validateConfiguration() internal view {
        require(backendMinter != address(0), "Backend minter address not set");
        require(admin != address(0), "Admin address not set");
        
        // Verificar se estamos na rede correta
        uint256 chainId = block.chainid;
        require(
            chainId == 8453 || // Base Mainnet
            chainId == 84532 || // Base Sepolia
            chainId == 31337, // Local
            "Unsupported network"
        );
        
        // Verificar se o deployer tem ETH suficiente
        require(msg.sender.balance >= 0.01 ether, "Insufficient ETH for deployment");
        
        console.log("✓ Configuration validated");
    }
    
    function shouldDeployBRcapy() internal view returns (bool) {
        // Por padrão, deploy apenas CapyCoin
        // Pode ser alterado via variável de ambiente
        return vm.envOr("DEPLOY_BRCAPY", false);
    }
    
    function isTestnet() internal view returns (bool) {
        return block.chainid == 84532 || block.chainid == 31337;
    }

    // ==========================================
    // OUTPUT
    // ==========================================
    
    function printDeploymentSummary() internal view {
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network:", getNetworkName(block.chainid));
        console.log("Block Number:", block.number);
        console.log("Timestamp:", block.timestamp);
        
        console.log("\n--- Contract Addresses ---");
        console.log("CapyCoin Hybrid:", address(capyCoin));
        if (address(brcapy) != address(0)) {
            console.log("BRcapy:", address(brcapy));
        }
        
        console.log("\n--- Configuration ---");
        console.log("Backend Minter:", backendMinter);
        console.log("Admin:", admin);
        console.log("Total Supply:", capyCoin.totalSupply() / 1e18, "CAPY");
        console.log("Remaining Supply:", capyCoin.remainingSupply() / 1e18, "CAPY");
        
        console.log("\n--- Next Steps ---");
        console.log("1. Save contract addresses");
        console.log("2. Verify contracts on Basescan");
        console.log("3. Update backend with contract address");
        console.log("4. Test all functionalities");
        console.log("5. Configure monitoring");
        
        if (isTestnet()) {
            console.log("\n--- Testnet Resources ---");
            console.log("Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
            console.log("Basescan Testnet: https://sepolia.basescan.org/address/", address(capyCoin));
        }
        
        // Salvar endereços em arquivo
        console.log("\n--- Contract Address for Frontend ---");
        console.log("NEXT_PUBLIC_CAPYCOIN_ADDRESS=", address(capyCoin));
    }
    
    function getNetworkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "Base Mainnet";
        if (chainId == 84532) return "Base Sepolia";
        if (chainId == 31337) return "Local/Anvil";
        return "Unknown";
    }
    
    function assertTrue(bool condition, string memory message) internal pure {
        require(condition, message);
    }
    
    function assertFalse(bool condition, string memory message) internal pure {
        require(!condition, message);
    }
} 