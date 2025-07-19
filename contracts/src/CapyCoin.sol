// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CapyCoin
 * @dev Token ERC-20 de utilidade do Capy Pay
 * 
 * Funcionalidades:
 * - Token ERC-20 padrão com 18 decimais
 * - Mintagem controlada pelo backend (MINTER_ROLE)
 * - Queima de tokens pelos holders
 * - Sistema de pausabilidade para emergências
 * - Controle de acesso baseado em roles
 * - Proteção contra reentrância
 * 
 * Roles:
 * - DEFAULT_ADMIN_ROLE: Administrador principal (pode gerenciar roles)
 * - MINTER_ROLE: Pode criar novos tokens (backend)
 * - PAUSER_ROLE: Pode pausar/despausar o contrato
 * 
 * Casos de Uso:
 * - Recompensas por transações
 * - Descontos em taxas
 * - Programa de fidelidade
 * - Governance (futuro)
 */
contract CapyCoin is ERC20, ERC20Burnable, AccessControl, Pausable, ReentrancyGuard {
    // ==========================================
    // ROLES
    // ==========================================
    
    /// @notice Role para mintagem de tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    /// @notice Role para pausar/despausar o contrato
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ==========================================
    // CONSTANTS
    // ==========================================
    
    /// @notice Máximo supply de tokens (100 milhões CAPY)
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;
    
    /// @notice Máximo de tokens que podem ser mintados por transação
    uint256 public constant MAX_MINT_PER_TX = 1_000_000 * 10**18; // 1 milhão CAPY

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    
    /// @notice Endereço do backend autorizado a fazer mint
    address public backendMinter;
    
    /// @notice Total de tokens mintados até agora
    uint256 public totalMinted;
    
    /// @notice Mapping para rastrear histórico de mints por endereço
    mapping(address => uint256) public mintedBy;
    
    /// @notice Mapping para rastrear quando cada endereço recebeu tokens pela última vez
    mapping(address => uint256) public lastMintTimestamp;

    // ==========================================
    // EVENTS
    // ==========================================
    
    /// @notice Emitido quando tokens são mintados
    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    
    /// @notice Emitido quando o backend minter é alterado
    event BackendMinterUpdated(address indexed oldMinter, address indexed newMinter);
    
    /// @notice Emitido quando tokens são queimados
    event TokensBurned(address indexed from, uint256 amount);

    // ==========================================
    // MODIFIERS
    // ==========================================
    
    /// @notice Verifica se o total supply não será excedido
    modifier withinSupplyLimit(uint256 amount) {
        require(totalSupply() + amount <= MAX_SUPPLY, "CapyCoin: Max supply exceeded");
        _;
    }
    
    /// @notice Verifica se a quantidade está dentro do limite por transação
    modifier withinMintLimit(uint256 amount) {
        require(amount <= MAX_MINT_PER_TX, "CapyCoin: Mint amount exceeds per-tx limit");
        _;
    }

    // ==========================================
    // CONSTRUCTOR
    // ==========================================
    
    /**
     * @notice Construtor do CapyCoin
     * @param _backendMinter Endereço do backend autorizado a fazer mint
     * @param _admin Endereço do administrador principal
     */
    constructor(
        address _backendMinter,
        address _admin
    ) ERC20("Capy Coin", "CAPY") {
        require(_backendMinter != address(0), "CapyCoin: Backend minter cannot be zero address");
        require(_admin != address(0), "CapyCoin: Admin cannot be zero address");
        
        // Configurar roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _backendMinter);
        _grantRole(PAUSER_ROLE, _admin);
        
        // Definir backend minter
        backendMinter = _backendMinter;
        
        emit BackendMinterUpdated(address(0), _backendMinter);
    }

    // ==========================================
    // MINTING FUNCTIONS
    // ==========================================
    
    /**
     * @notice Minta tokens para um endereço específico
     * @dev Apenas endereços com MINTER_ROLE podem chamar
     * @param to Endereço que receberá os tokens
     * @param amount Quantidade de tokens a serem mintados
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        nonReentrant
        withinSupplyLimit(amount)
        withinMintLimit(amount)
    {
        require(to != address(0), "CapyCoin: Cannot mint to zero address");
        require(amount > 0, "CapyCoin: Mint amount must be greater than zero");
        
        // Atualizar estatísticas
        totalMinted += amount;
        mintedBy[msg.sender] += amount;
        lastMintTimestamp[to] = block.timestamp;
        
        // Mintar tokens
        _mint(to, amount);
        
        emit TokensMinted(to, amount, msg.sender);
    }
    
    /**
     * @notice Minta tokens em lote para múltiplos endereços
     * @dev Apenas endereços com MINTER_ROLE podem chamar
     * @param recipients Lista de endereços que receberão tokens
     * @param amounts Lista de quantidades correspondentes
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(recipients.length == amounts.length, "CapyCoin: Arrays length mismatch");
        require(recipients.length > 0, "CapyCoin: Empty arrays");
        require(recipients.length <= 100, "CapyCoin: Too many recipients"); // Limite de gas
        
        uint256 totalAmount = 0;
        
        // Calcular total e validar
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "CapyCoin: Cannot mint to zero address");
            require(amounts[i] > 0, "CapyCoin: Amount must be greater than zero");
            totalAmount += amounts[i];
        }
        
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "CapyCoin: Max supply exceeded");
        require(totalAmount <= MAX_MINT_PER_TX, "CapyCoin: Total mint exceeds per-tx limit");
        
        // Executar mints
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            lastMintTimestamp[recipients[i]] = block.timestamp;
            emit TokensMinted(recipients[i], amounts[i], msg.sender);
        }
        
        // Atualizar estatísticas
        totalMinted += totalAmount;
        mintedBy[msg.sender] += totalAmount;
    }

    // ==========================================
    // BURNING FUNCTIONS
    // ==========================================
    
    /**
     * @notice Queima tokens do próprio saldo
     * @param amount Quantidade de tokens a serem queimados
     */
    function burn(uint256 amount) public override whenNotPaused nonReentrant {
        require(amount > 0, "CapyCoin: Burn amount must be greater than zero");
        
        super.burn(amount);
        
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @notice Queima tokens de outro endereço (com aprovação)
     * @param from Endereço de onde os tokens serão queimados
     * @param amount Quantidade de tokens a serem queimados
     */
    function burnFrom(address from, uint256 amount) public override whenNotPaused nonReentrant {
        require(amount > 0, "CapyCoin: Burn amount must be greater than zero");
        
        super.burnFrom(from, amount);
        
        emit TokensBurned(from, amount);
    }

    // ==========================================
    // ADMIN FUNCTIONS
    // ==========================================
    
    /**
     * @notice Atualiza o endereço do backend minter
     * @dev Apenas DEFAULT_ADMIN_ROLE pode chamar
     * @param newBackendMinter Novo endereço do backend minter
     */
    function updateBackendMinter(address newBackendMinter) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newBackendMinter != address(0), "CapyCoin: New minter cannot be zero address");
        require(newBackendMinter != backendMinter, "CapyCoin: Same minter address");
        
        address oldMinter = backendMinter;
        
        // Remover role do antigo e adicionar ao novo
        _revokeRole(MINTER_ROLE, oldMinter);
        _grantRole(MINTER_ROLE, newBackendMinter);
        
        backendMinter = newBackendMinter;
        
        emit BackendMinterUpdated(oldMinter, newBackendMinter);
    }
    
    /**
     * @notice Pausa o contrato (emergência)
     * @dev Apenas PAUSER_ROLE pode chamar
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Despausa o contrato
     * @dev Apenas PAUSER_ROLE pode chamar
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ==========================================
    // VIEW FUNCTIONS
    // ==========================================
    
    /**
     * @notice Retorna informações do token
     * @return name Nome do token
     * @return symbol Símbolo do token
     * @return decimals Número de casas decimais
     * @return totalSupply Supply total atual
     * @return maxSupply Supply máximo
     * @return totalMinted Total já mintado
     */
    function tokenInfo() 
        external 
        view 
        returns (
            string memory name,
            string memory symbol,
            uint8 decimals,
            uint256 totalSupply,
            uint256 maxSupply,
            uint256 totalMinted
        ) 
    {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY,
            totalMinted
        );
    }
    
    /**
     * @notice Verifica se um endereço pode mintar tokens
     * @param account Endereço a ser verificado
     * @return bool True se pode mintar
     */
    function canMint(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account) && !paused();
    }
    
    /**
     * @notice Retorna quantos tokens ainda podem ser mintados
     * @return uint256 Quantidade disponível para mint
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
    
    /**
     * @notice Retorna estatísticas de mint de um endereço
     * @param minter Endereço do minter
     * @return totalMinted Total mintado por este endereço
     * @return canMintNow Se pode mintar agora
     */
    function getMinterStats(address minter) 
        external 
        view 
        returns (uint256 totalMinted, bool canMintNow) 
    {
        return (mintedBy[minter], canMint(minter));
    }

    // ==========================================
    // OVERRIDES
    // ==========================================
    
    /**
     * @notice Override para pausar transferências quando pausado
     */
    function _update(address from, address to, uint256 value)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, value);
    }
    
    /**
     * @notice Suporte a interfaces
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC20, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ==========================================
    // EMERGENCY FUNCTIONS
    // ==========================================
    
    /**
     * @notice Função de emergência para recuperar tokens ERC20 enviados por engano
     * @dev Apenas DEFAULT_ADMIN_ROLE pode chamar
     * @param token Endereço do token a ser recuperado
     * @param amount Quantidade a ser recuperada
     */
    function emergencyRecoverERC20(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(this), "CapyCoin: Cannot recover own tokens");
        require(token != address(0), "CapyCoin: Invalid token address");
        
        IERC20(token).transfer(msg.sender, amount);
    }
} 