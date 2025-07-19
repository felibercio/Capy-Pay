// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CapyCoin.sol";
import "../src/BRcapy.sol";

/**
 * @title Deploy
 * @dev Script para deployment dos contratos Capy Pay na rede Base
 * 
 * Como usar:
 * 
 * 1. Base Sepolia (Testnet):
 * forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
 * 
 * 2. Base Mainnet:
 * forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
 * 
 * 3. Simulação local:
 * forge script script/Deploy.s.sol
 */
contract Deploy is Script {
    // ==========================================
    // CONFIGURATION
    // ==========================================
    
    // Endereços do backend (obtidos das variáveis de ambiente)
    address public backendMinter;
    address public backendUpdater;
    address public admin;
    
    // Configurações iniciais da BRcapy
    uint256 public constant INITIAL_BRCAPY_VALUE = 1.05234567 * 10**18; // 1.05234567 BRL
    uint256 public constant INITIAL_CDI_RATE = 1175; // 11.75%
    uint256 public constant INITIAL_INTERNAL_FEE = 110; // 1.10%
    
    // Contratos deployados
    CapyCoin public capyCoin;
    BRcapy public brcapy;
    
    // Informações de deployment
    struct DeploymentInfo {
        address capyCoinAddress;
        address brcapyAddress;
        uint256 blockNumber;
        uint256 timestamp;
        uint256 chainId;
        address deployer;
    }
    
    DeploymentInfo public deploymentInfo;

    // ==========================================
    // SETUP
    // ==========================================
    
    function setUp() public {
        // Obter endereços das variáveis de ambiente
        backendMinter = vm.envOr("BACKEND_MINTER_ADDRESS", address(0));
        backendUpdater = vm.envOr("BACKEND_UPDATER_ADDRESS", address(0));
        
        // Se não fornecidos, usar endereços padrão para teste
        if (backendMinter == address(0)) {
            backendMinter = 0x742d35Cc6634C0532925a3b8D404d521AC7bd11f;
            console.log("WARNING: Using default backend minter address");
        }
        
        if (backendUpdater == address(0)) {
            backendUpdater = backendMinter; // Usar o mesmo endereço por padrão
            console.log("WARNING: Using backend minter as updater");
        }
        
        // Admin será o deployer por padrão
        admin = msg.sender;
        
        console.log("=== DEPLOYMENT CONFIGURATION ===");
        console.log("Backend Minter:", backendMinter);
        console.log("Backend Updater:", backendUpdater);
        console.log("Admin:", admin);
        console.log("Chain ID:", block.chainid);
    }

    // ==========================================
    // MAIN DEPLOYMENT FUNCTION
    // ==========================================
    
    function run() public {
        // Validar configuração
        validateConfiguration();
        
        // Iniciar broadcast das transações
        vm.startBroadcast();
        
        console.log("\n=== STARTING DEPLOYMENT ===");
        console.log("Deployer:", msg.sender);
        console.log("Balance:", msg.sender.balance / 1e18, "ETH");
        
        // Deploy CapyCoin
        deployCapyCoin();
        
        // Deploy BRcapy
        deployBRcapy();
        
        // Configurações pós-deployment
        postDeploymentSetup();
        
        // Finalizar broadcast
        vm.stopBroadcast();
        
        // Salvar informações de deployment
        saveDeploymentInfo();
        
        // Exibir resumo
        printDeploymentSummary();
        
        // Verificar deployment
        verifyDeployment();
    }

    // ==========================================
    // DEPLOYMENT FUNCTIONS
    // ==========================================
    
    function deployCapyCoin() internal {
        console.log("\n--- Deploying CapyCoin ---");
        
        // Deploy do contrato
        capyCoin = new CapyCoin(backendMinter, admin);
        
        console.log("CapyCoin deployed at:", address(capyCoin));
        console.log("Name:", capyCoin.name());
        console.log("Symbol:", capyCoin.symbol());
        console.log("Decimals:", capyCoin.decimals());
        console.log("Max Supply:", capyCoin.MAX_SUPPLY() / 1e18, "CAPY");
        console.log("Backend Minter:", capyCoin.backendMinter());
        
        // Verificar roles
        require(capyCoin.hasRole(capyCoin.DEFAULT_ADMIN_ROLE(), admin), "Admin role not set");
        require(capyCoin.hasRole(capyCoin.MINTER_ROLE(), backendMinter), "Minter role not set");
        require(capyCoin.hasRole(capyCoin.PAUSER_ROLE(), admin), "Pauser role not set");
        
        console.log("✓ CapyCoin roles configured correctly");
    }
    
    function deployBRcapy() internal {
        console.log("\n--- Deploying BRcapy ---");
        
        // Deploy do contrato
        brcapy = new BRcapy(
            INITIAL_BRCAPY_VALUE,
            INITIAL_CDI_RATE,
            INITIAL_INTERNAL_FEE,
            backendUpdater,
            admin
        );
        
        console.log("BRcapy deployed at:", address(brcapy));
        console.log("Name:", brcapy.name());
        console.log("Symbol:", brcapy.symbol());
        console.log("Decimals:", brcapy.decimals());
        console.log("Initial Value:", brcapy.currentValue() / 1e18, "BRL");
        console.log("CDI Rate:", brcapy.cdiRate() / 100, "%");
        console.log("Internal Fee:", brcapy.internalFeeRate() / 100, "%");
        console.log("Current APY:", brcapy.currentAPY() / 100, "%");
        console.log("Max Supply:", brcapy.MAX_SUPPLY() / 1e18, "BRCAPY");
        console.log("Backend Updater:", brcapy.backendUpdater());
        
        // Verificar roles
        require(brcapy.hasRole(brcapy.DEFAULT_ADMIN_ROLE(), admin), "Admin role not set");
        require(brcapy.hasRole(brcapy.VALUE_UPDATER_ROLE(), backendUpdater), "Value updater role not set");
        require(brcapy.hasRole(brcapy.MINTER_ROLE(), backendUpdater), "Minter role not set");
        require(brcapy.hasRole(brcapy.PAUSER_ROLE(), admin), "Pauser role not set");
        
        console.log("✓ BRcapy roles configured correctly");
    }
    
    function postDeploymentSetup() internal {
        console.log("\n--- Post-Deployment Setup ---");
        
        // Verificar se contratos estão funcionando
        testBasicFunctionality();
        
        // Configurações adicionais podem ser adicionadas aqui
        console.log("✓ Post-deployment setup completed");
    }
    
    function testBasicFunctionality() internal {
        console.log("Testing basic functionality...");
        
        // Teste CapyCoin - verificar se pode mintar
        assertTrue(capyCoin.canMint(backendMinter), "Backend cannot mint CAPY");
        assertFalse(capyCoin.canMint(address(0x123)), "Random address can mint CAPY");
        
        // Teste BRcapy - verificar conversões
        uint256 brlAmount = 1000 * 10**18; // 1000 BRL
        uint256 expectedTokens = brcapy.brlToTokens(brlAmount);
        uint256 backToBrl = brcapy.tokensToBRL(expectedTokens);
        
        assertEq(backToBrl, brlAmount, "BRL conversion mismatch");
        
        console.log("✓ Basic functionality tests passed");
    }

    // ==========================================
    // VALIDATION AND VERIFICATION
    // ==========================================
    
    function validateConfiguration() internal view {
        require(backendMinter != address(0), "Backend minter address not set");
        require(backendUpdater != address(0), "Backend updater address not set");
        require(admin != address(0), "Admin address not set");
        require(INITIAL_BRCAPY_VALUE > 0, "Initial BRcapy value must be > 0");
        require(INITIAL_CDI_RATE >= INITIAL_INTERNAL_FEE, "CDI rate must be >= internal fee");
        
        // Verificar se estamos na rede correta
        uint256 chainId = block.chainid;
        require(
            chainId == 8453 || // Base Mainnet
            chainId == 84532 || // Base Sepolia
            chainId == 31337, // Local
            "Unsupported network"
        );
        
        console.log("✓ Configuration validated");
    }
    
    function verifyDeployment() internal view {
        console.log("\n=== DEPLOYMENT VERIFICATION ===");
        
        // Verificar se contratos foram deployados
        require(address(capyCoin) != address(0), "CapyCoin not deployed");
        require(address(brcapy) != address(0), "BRcapy not deployed");
        
        // Verificar código dos contratos
        require(address(capyCoin).code.length > 0, "CapyCoin has no code");
        require(address(brcapy).code.length > 0, "BRcapy has no code");
        
        // Verificar configurações
        require(capyCoin.backendMinter() == backendMinter, "CapyCoin backend minter mismatch");
        require(brcapy.backendUpdater() == backendUpdater, "BRcapy backend updater mismatch");
        require(brcapy.currentValue() == INITIAL_BRCAPY_VALUE, "BRcapy initial value mismatch");
        
        console.log("✓ Deployment verification passed");
    }

    // ==========================================
    // INFORMATION MANAGEMENT
    // ==========================================
    
    function saveDeploymentInfo() internal {
        deploymentInfo = DeploymentInfo({
            capyCoinAddress: address(capyCoin),
            brcapyAddress: address(brcapy),
            blockNumber: block.number,
            timestamp: block.timestamp,
            chainId: block.chainid,
            deployer: msg.sender
        });
    }
    
    function printDeploymentSummary() internal view {
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network:", getNetworkName(block.chainid));
        console.log("Block Number:", block.number);
        console.log("Timestamp:", block.timestamp);
        console.log("Gas Price:", tx.gasprice / 1e9, "gwei");
        
        console.log("\n--- Contract Addresses ---");
        console.log("CapyCoin:", address(capyCoin));
        console.log("BRcapy:", address(brcapy));
        
        console.log("\n--- Configuration ---");
        console.log("Backend Minter:", backendMinter);
        console.log("Backend Updater:", backendUpdater);
        console.log("Admin:", admin);
        
        console.log("\n--- Next Steps ---");
        console.log("1. Verify contracts on Basescan");
        console.log("2. Update backend with contract addresses");
        console.log("3. Test minting functionality");
        console.log("4. Configure monitoring and alerts");
        
        if (block.chainid == 84532) {
            console.log("\n--- Testnet Faucets ---");
            console.log("Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
        }
    }
    
    function getNetworkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "Base Mainnet";
        if (chainId == 84532) return "Base Sepolia";
        if (chainId == 31337) return "Local/Anvil";
        return "Unknown";
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================
    
    function assertTrue(bool condition, string memory message) internal pure {
        require(condition, message);
    }
    
    function assertFalse(bool condition, string memory message) internal pure {
        require(!condition, message);
    }
    
    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        require(a == b, message);
    }

    // ==========================================
    // GETTERS FOR DEPLOYED CONTRACTS
    // ==========================================
    
    function getCapyCoinAddress() external view returns (address) {
        return address(capyCoin);
    }
    
    function getBRcapyAddress() external view returns (address) {
        return address(brcapy);
    }
    
    function getDeploymentInfo() external view returns (DeploymentInfo memory) {
        return deploymentInfo;
    }
}

/**
 * @title DeployTestnet
 * @dev Script específico para deployment em testnet com configurações de teste
 */
contract DeployTestnet is Deploy {
    function run() public override {
        // Configurações específicas para testnet
        console.log("=== TESTNET DEPLOYMENT ===");
        
        // Executar deployment padrão
        super.run();
        
        // Configurações adicionais para testnet
        setupTestnetConfiguration();
    }
    
    function setupTestnetConfiguration() internal {
        console.log("\n--- Testnet Configuration ---");
        
        // Em testnet, podemos fazer mint inicial para testes
        if (block.chainid == 84532) { // Base Sepolia
            console.log("Setting up testnet tokens for testing...");
            
            // Mint inicial de CapyCoin para o deployer (para testes)
            if (msg.sender == admin) {
                capyCoin.mint(msg.sender, 10000 * 10**18); // 10k CAPY para testes
                console.log("✓ Minted 10,000 CAPY for testing");
            }
            
            // Mint inicial de BRcapy para o deployer (para testes)
            if (msg.sender == admin) {
                brcapy.mintFromBRL(msg.sender, 5000 * 10**18); // 5000 BRL em BRcapy para testes
                console.log("✓ Minted BRcapy equivalent to 5,000 BRL for testing");
            }
        }
        
        console.log("✓ Testnet configuration completed");
    }
}

/**
 * @title DeployMainnet
 * @dev Script específico para deployment em mainnet com verificações adicionais
 */
contract DeployMainnet is Deploy {
    function run() public override {
        // Verificações adicionais para mainnet
        require(block.chainid == 8453, "This script is only for Base Mainnet");
        
        console.log("=== MAINNET DEPLOYMENT ===");
        console.log("WARNING: Deploying to MAINNET. Double-check all configurations!");
        
        // Verificações de segurança adicionais
        mainnetSecurityChecks();
        
        // Executar deployment padrão
        super.run();
        
        // Configurações específicas para mainnet
        setupMainnetConfiguration();
    }
    
    function mainnetSecurityChecks() internal view {
        console.log("\n--- Mainnet Security Checks ---");
        
        // Verificar se os endereços do backend são válidos
        require(backendMinter != address(0), "Backend minter not configured");
        require(backendUpdater != address(0), "Backend updater not configured");
        require(backendMinter.code.length == 0, "Backend minter should be EOA");
        require(backendUpdater.code.length == 0, "Backend updater should be EOA");
        
        // Verificar se o deployer tem ETH suficiente
        require(msg.sender.balance >= 0.1 ether, "Insufficient ETH for deployment");
        
        console.log("✓ Mainnet security checks passed");
    }
    
    function setupMainnetConfiguration() internal view {
        console.log("\n--- Mainnet Configuration ---");
        console.log("✓ No initial minting on mainnet");
        console.log("✓ All roles configured for production");
        console.log("✓ Ready for production use");
    }
} 