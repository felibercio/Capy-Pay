// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title BRcapy
 * @dev Yieldcoin do Capy Pay com valorização baseada em CDI + taxas internas
 * 
 * Funcionalidades:
 * - Token ERC-20 com valor dinâmico
 * - Atualização de valor pelo backend (VALUE_UPDATER_ROLE)
 * - Mintagem/queima proporcional ao valor atual
 * - Cálculo de yield baseado em CDI brasileiro
 * - Lastro conceitual em stablecoins
 * - Histórico de valores para auditoria
 * 
 * Roles:
 * - DEFAULT_ADMIN_ROLE: Administrador principal
 * - VALUE_UPDATER_ROLE: Pode atualizar o valor da BRcapy (backend)
 * - MINTER_ROLE: Pode mintar/queimar tokens (backend)
 * - PAUSER_ROLE: Pode pausar o contrato
 * 
 * Mecânica:
 * - 1 BRcapy = currentValue BRL (inicialmente ~1.05 BRL)
 * - Valor é atualizado diariamente baseado no CDI + taxas
 * - Mint/burn são proporcionais ao valor atual
 * - Histórico mantido para transparência
 */
contract BRcapy is ERC20, ERC20Burnable, AccessControl, Pausable, ReentrancyGuard {
    // ==========================================
    // ROLES
    // ==========================================
    
    /// @notice Role para atualizar o valor da BRcapy
    bytes32 public constant VALUE_UPDATER_ROLE = keccak256("VALUE_UPDATER_ROLE");
    
    /// @notice Role para mintagem/queima de tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    /// @notice Role para pausar/despausar o contrato
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ==========================================
    // CONSTANTS
    // ==========================================
    
    /// @notice Máximo supply de tokens (50 milhões BRcapy)
    uint256 public constant MAX_SUPPLY = 50_000_000 * 10**18;
    
    /// @notice Precisão para cálculos (18 decimais)
    uint256 public constant PRECISION = 10**18;
    
    /// @notice Máximo de mudança de valor por atualização (20% = 2000 basis points)
    uint256 public constant MAX_VALUE_CHANGE_BPS = 2000;
    
    /// @notice Base para basis points (100% = 10000)
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Intervalo mínimo entre atualizações de valor (1 hora)
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    
    /// @notice Valor atual de 1 BRcapy em BRL (com 18 decimais)
    /// @dev Exemplo: 1.05234567 BRL = 1052345670000000000
    uint256 public currentValue;
    
    /// @notice Taxa CDI atual em basis points (ex: 1175 = 11.75%)
    uint256 public cdiRate;
    
    /// @notice Taxa interna em basis points (ex: 110 = 1.10%)
    uint256 public internalFeeRate;
    
    /// @notice APY total atual em basis points (CDI - taxas internas)
    uint256 public currentAPY;
    
    /// @notice Timestamp da última atualização de valor
    uint256 public lastValueUpdate;
    
    /// @notice Endereço do backend autorizado
    address public backendUpdater;
    
    /// @notice Total de valor em BRL representado pelos tokens
    uint256 public totalValueBRL;

    // ==========================================
    // STRUCTS
    // ==========================================
    
    /// @notice Estrutura para histórico de valores
    struct ValueHistory {
        uint256 value;           // Valor em BRL (18 decimals)
        uint256 cdiRate;         // Taxa CDI em basis points
        uint256 internalFee;     // Taxa interna em basis points
        uint256 apy;             // APY total em basis points
        uint256 timestamp;       // Timestamp da atualização
        uint256 totalSupply;     // Total supply no momento
        address updatedBy;       // Quem fez a atualização
    }

    // ==========================================
    // MAPPINGS
    // ==========================================
    
    /// @notice Histórico de valores (index => ValueHistory)
    mapping(uint256 => ValueHistory) public valueHistory;
    
    /// @notice Contador de entradas no histórico
    uint256 public historyCount;
    
    /// @notice Mapping para rastrear yields acumulados por usuário
    mapping(address => uint256) public accumulatedYield;
    
    /// @notice Mapping para rastrear quando cada usuário entrou
    mapping(address => uint256) public userEntryTimestamp;

    // ==========================================
    // EVENTS
    // ==========================================
    
    /// @notice Emitido quando o valor da BRcapy é atualizado
    event ValueUpdated(
        uint256 indexed historyIndex,
        uint256 oldValue,
        uint256 newValue,
        uint256 cdiRate,
        uint256 internalFee,
        uint256 apy,
        address indexed updatedBy
    );
    
    /// @notice Emitido quando tokens são mintados
    event TokensMinted(
        address indexed to,
        uint256 tokenAmount,
        uint256 brlValue,
        uint256 currentValue
    );
    
    /// @notice Emitido quando tokens são queimados
    event TokensBurned(
        address indexed from,
        uint256 tokenAmount,
        uint256 brlValue,
        uint256 currentValue
    );
    
    /// @notice Emitido quando o backend updater é alterado
    event BackendUpdaterChanged(address indexed oldUpdater, address indexed newUpdater);
    
    /// @notice Emitido quando yield é calculado
    event YieldCalculated(address indexed user, uint256 yieldAmount, uint256 period);

    // ==========================================
    // MODIFIERS
    // ==========================================
    
    /// @notice Verifica se passou tempo suficiente desde a última atualização
    modifier validUpdateInterval() {
        require(
            block.timestamp >= lastValueUpdate + MIN_UPDATE_INTERVAL,
            "BRcapy: Update interval not met"
        );
        _;
    }
    
    /// @notice Verifica se a mudança de valor está dentro do limite
    modifier validValueChange(uint256 newValue) {
        if (currentValue > 0) {
            uint256 change = newValue > currentValue 
                ? ((newValue - currentValue) * BASIS_POINTS) / currentValue
                : ((currentValue - newValue) * BASIS_POINTS) / currentValue;
            
            require(change <= MAX_VALUE_CHANGE_BPS, "BRcapy: Value change too large");
        }
        _;
    }

    // ==========================================
    // CONSTRUCTOR
    // ==========================================
    
    /**
     * @notice Construtor do BRcapy
     * @param _initialValue Valor inicial em BRL (com 18 decimais)
     * @param _cdiRate Taxa CDI inicial em basis points
     * @param _internalFeeRate Taxa interna em basis points
     * @param _backendUpdater Endereço do backend
     * @param _admin Endereço do administrador
     */
    constructor(
        uint256 _initialValue,
        uint256 _cdiRate,
        uint256 _internalFeeRate,
        address _backendUpdater,
        address _admin
    ) ERC20("BRcapy", "BRCAPY") {
        require(_initialValue > 0, "BRcapy: Initial value must be greater than zero");
        require(_backendUpdater != address(0), "BRcapy: Backend updater cannot be zero");
        require(_admin != address(0), "BRcapy: Admin cannot be zero");
        require(_cdiRate >= _internalFeeRate, "BRcapy: CDI rate must be >= internal fee");
        
        // Configurar valores iniciais
        currentValue = _initialValue;
        cdiRate = _cdiRate;
        internalFeeRate = _internalFeeRate;
        currentAPY = _cdiRate - _internalFeeRate; // APY = CDI - taxas internas
        lastValueUpdate = block.timestamp;
        backendUpdater = _backendUpdater;
        
        // Configurar roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(VALUE_UPDATER_ROLE, _backendUpdater);
        _grantRole(MINTER_ROLE, _backendUpdater);
        _grantRole(PAUSER_ROLE, _admin);
        
        // Salvar no histórico
        _recordValueHistory(_initialValue, _cdiRate, _internalFeeRate, _admin);
        
        emit BackendUpdaterChanged(address(0), _backendUpdater);
    }

    // ==========================================
    // VALUE UPDATE FUNCTIONS
    // ==========================================
    
    /**
     * @notice Atualiza o valor da BRcapy
     * @dev Apenas VALUE_UPDATER_ROLE pode chamar
     * @param newValue Novo valor em BRL (18 decimais)
     * @param newCdiRate Nova taxa CDI em basis points
     * @param newInternalFeeRate Nova taxa interna em basis points
     */
    function updateValue(
        uint256 newValue,
        uint256 newCdiRate,
        uint256 newInternalFeeRate
    ) 
        external 
        onlyRole(VALUE_UPDATER_ROLE)
        whenNotPaused
        validUpdateInterval
        validValueChange(newValue)
    {
        require(newValue > 0, "BRcapy: New value must be greater than zero");
        require(newCdiRate >= newInternalFeeRate, "BRcapy: CDI rate must be >= internal fee");
        
        uint256 oldValue = currentValue;
        
        // Atualizar valores
        currentValue = newValue;
        cdiRate = newCdiRate;
        internalFeeRate = newInternalFeeRate;
        currentAPY = newCdiRate - newInternalFeeRate;
        lastValueUpdate = block.timestamp;
        
        // Atualizar valor total em BRL
        totalValueBRL = (totalSupply() * currentValue) / PRECISION;
        
        // Registrar no histórico
        _recordValueHistory(newValue, newCdiRate, newInternalFeeRate, msg.sender);
        
        emit ValueUpdated(
            historyCount - 1,
            oldValue,
            newValue,
            newCdiRate,
            newInternalFeeRate,
            currentAPY,
            msg.sender
        );
    }
    
    /**
     * @notice Registra entrada no histórico de valores
     */
    function _recordValueHistory(
        uint256 value,
        uint256 cdiRateValue,
        uint256 internalFee,
        address updater
    ) internal {
        valueHistory[historyCount] = ValueHistory({
            value: value,
            cdiRate: cdiRateValue,
            internalFee: internalFee,
            apy: cdiRateValue - internalFee,
            timestamp: block.timestamp,
            totalSupply: totalSupply(),
            updatedBy: updater
        });
        
        historyCount++;
    }

    // ==========================================
    // MINTING AND BURNING FUNCTIONS
    // ==========================================
    
    /**
     * @notice Minta BRcapy baseado no valor em BRL
     * @dev Apenas MINTER_ROLE pode chamar
     * @param to Endereço que receberá os tokens
     * @param brlAmount Valor em BRL a ser convertido (18 decimals)
     */
    function mintFromBRL(address to, uint256 brlAmount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(to != address(0), "BRcapy: Cannot mint to zero address");
        require(brlAmount > 0, "BRcapy: BRL amount must be greater than zero");
        require(currentValue > 0, "BRcapy: Current value not set");
        
        // Calcular quantidade de tokens a serem mintados
        uint256 tokenAmount = (brlAmount * PRECISION) / currentValue;
        
        require(totalSupply() + tokenAmount <= MAX_SUPPLY, "BRcapy: Max supply exceeded");
        
        // Atualizar timestamp de entrada do usuário
        if (balanceOf(to) == 0) {
            userEntryTimestamp[to] = block.timestamp;
        }
        
        // Mintar tokens
        _mint(to, tokenAmount);
        
        // Atualizar valor total em BRL
        totalValueBRL = (totalSupply() * currentValue) / PRECISION;
        
        emit TokensMinted(to, tokenAmount, brlAmount, currentValue);
    }
    
    /**
     * @notice Queima BRcapy e retorna valor em BRL
     * @param tokenAmount Quantidade de tokens a serem queimados
     * @return brlValue Valor em BRL correspondente
     */
    function burnToBRL(uint256 tokenAmount)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 brlValue)
    {
        require(tokenAmount > 0, "BRcapy: Token amount must be greater than zero");
        require(balanceOf(msg.sender) >= tokenAmount, "BRcapy: Insufficient balance");
        require(currentValue > 0, "BRcapy: Current value not set");
        
        // Calcular valor em BRL
        brlValue = (tokenAmount * currentValue) / PRECISION;
        
        // Queimar tokens
        _burn(msg.sender, tokenAmount);
        
        // Atualizar valor total em BRL
        totalValueBRL = (totalSupply() * currentValue) / PRECISION;
        
        emit TokensBurned(msg.sender, tokenAmount, brlValue, currentValue);
        
        return brlValue;
    }
    
    /**
     * @notice Minta tokens diretamente (quantidade específica)
     * @dev Apenas MINTER_ROLE pode chamar
     * @param to Endereço que receberá os tokens
     * @param tokenAmount Quantidade de tokens a serem mintados
     */
    function mint(address to, uint256 tokenAmount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        require(to != address(0), "BRcapy: Cannot mint to zero address");
        require(tokenAmount > 0, "BRcapy: Token amount must be greater than zero");
        require(totalSupply() + tokenAmount <= MAX_SUPPLY, "BRcapy: Max supply exceeded");
        
        // Calcular valor em BRL
        uint256 brlValue = (tokenAmount * currentValue) / PRECISION;
        
        // Atualizar timestamp de entrada do usuário
        if (balanceOf(to) == 0) {
            userEntryTimestamp[to] = block.timestamp;
        }
        
        // Mintar tokens
        _mint(to, tokenAmount);
        
        // Atualizar valor total em BRL
        totalValueBRL = (totalSupply() * currentValue) / PRECISION;
        
        emit TokensMinted(to, tokenAmount, brlValue, currentValue);
    }

    // ==========================================
    // YIELD CALCULATION FUNCTIONS
    // ==========================================
    
    /**
     * @notice Calcula yield acumulado de um usuário
     * @param user Endereço do usuário
     * @return yieldAmount Yield acumulado em tokens BRcapy
     * @return yieldValueBRL Valor do yield em BRL
     */
    function calculateYield(address user) 
        external 
        view 
        returns (uint256 yieldAmount, uint256 yieldValueBRL) 
    {
        uint256 balance = balanceOf(user);
        if (balance == 0 || userEntryTimestamp[user] == 0) {
            return (0, 0);
        }
        
        uint256 timeHeld = block.timestamp - userEntryTimestamp[user];
        uint256 annualSeconds = 365 days;
        
        // Yield = balance * APY * timeHeld / annualSeconds
        yieldAmount = (balance * currentAPY * timeHeld) / (BASIS_POINTS * annualSeconds);
        yieldValueBRL = (yieldAmount * currentValue) / PRECISION;
        
        return (yieldAmount, yieldValueBRL);
    }
    
    /**
     * @notice Calcula APY efetivo baseado no histórico
     * @param startTimestamp Timestamp de início do período
     * @param endTimestamp Timestamp de fim do período
     * @return effectiveAPY APY efetivo no período
     */
    function calculateEffectiveAPY(uint256 startTimestamp, uint256 endTimestamp)
        external
        view
        returns (uint256 effectiveAPY)
    {
        require(endTimestamp > startTimestamp, "BRcapy: Invalid timestamp range");
        
        // Para MVP, retornar APY atual
        // Em versão completa, calcular baseado no histórico
        return currentAPY;
    }

    // ==========================================
    // VIEW FUNCTIONS
    // ==========================================
    
    /**
     * @notice Retorna informações completas do token
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
            uint256 currentValue,
            uint256 totalValueBRL,
            uint256 currentAPY,
            uint256 cdiRate,
            uint256 internalFeeRate
        ) 
    {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY,
            currentValue,
            totalValueBRL,
            currentAPY,
            cdiRate,
            internalFeeRate
        );
    }
    
    /**
     * @notice Converte quantidade de tokens para valor em BRL
     * @param tokenAmount Quantidade de tokens
     * @return brlValue Valor correspondente em BRL
     */
    function tokensToBRL(uint256 tokenAmount) external view returns (uint256 brlValue) {
        if (currentValue == 0) return 0;
        return (tokenAmount * currentValue) / PRECISION;
    }
    
    /**
     * @notice Converte valor em BRL para quantidade de tokens
     * @param brlAmount Valor em BRL
     * @return tokenAmount Quantidade de tokens correspondente
     */
    function brlToTokens(uint256 brlAmount) external view returns (uint256 tokenAmount) {
        if (currentValue == 0) return 0;
        return (brlAmount * PRECISION) / currentValue;
    }
    
    /**
     * @notice Retorna entrada do histórico de valores
     * @param index Índice no histórico
     */
    function getValueHistory(uint256 index) 
        external 
        view 
        returns (ValueHistory memory) 
    {
        require(index < historyCount, "BRcapy: History index out of bounds");
        return valueHistory[index];
    }
    
    /**
     * @notice Retorna últimas N entradas do histórico
     * @param count Número de entradas a retornar
     */
    function getRecentHistory(uint256 count) 
        external 
        view 
        returns (ValueHistory[] memory) 
    {
        if (count > historyCount) count = historyCount;
        if (count == 0) return new ValueHistory[](0);
        
        ValueHistory[] memory recent = new ValueHistory[](count);
        uint256 startIndex = historyCount - count;
        
        for (uint256 i = 0; i < count; i++) {
            recent[i] = valueHistory[startIndex + i];
        }
        
        return recent;
    }

    // ==========================================
    // ADMIN FUNCTIONS
    // ==========================================
    
    /**
     * @notice Atualiza o endereço do backend updater
     */
    function updateBackendUpdater(address newUpdater) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newUpdater != address(0), "BRcapy: New updater cannot be zero");
        require(newUpdater != backendUpdater, "BRcapy: Same updater address");
        
        address oldUpdater = backendUpdater;
        
        // Atualizar roles
        _revokeRole(VALUE_UPDATER_ROLE, oldUpdater);
        _revokeRole(MINTER_ROLE, oldUpdater);
        
        _grantRole(VALUE_UPDATER_ROLE, newUpdater);
        _grantRole(MINTER_ROLE, newUpdater);
        
        backendUpdater = newUpdater;
        
        emit BackendUpdaterChanged(oldUpdater, newUpdater);
    }
    
    /**
     * @notice Pausa o contrato
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Despausa o contrato
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
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
        
        // Atualizar timestamps para cálculo de yield
        if (to != address(0) && from != address(0)) {
            // Transferência normal - atualizar timestamp do destinatário se for novo holder
            if (balanceOf(to) == 0) {
                userEntryTimestamp[to] = block.timestamp;
            }
        }
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
     * @notice Função de emergência para recuperar tokens ERC20
     */
    function emergencyRecoverERC20(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(this), "BRcapy: Cannot recover own tokens");
        require(token != address(0), "BRcapy: Invalid token address");
        
        IERC20(token).transfer(msg.sender, amount);
    }
} 