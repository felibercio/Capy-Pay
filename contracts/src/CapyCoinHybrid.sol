// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CapyCoin - Token Oficial do Capy Pay
 * @dev Token ERC-20 completo com sistema de recompensas, staking e referral
 * @author Capy Pay Team
 * 
 * Funcionalidades principais:
 * - Sistema de recompensas por atividades (transações, login, etc)
 * - Programa de referral com comissões automáticas
 * - Staking nativo com APY de 1% ao dia
 * - Sistema de níveis gamificado
 * - Integração completa com o frontend do Capy Pay
 */
contract CapyCoinHybrid is ERC20, ERC20Burnable, AccessControl, Pausable, ReentrancyGuard {
    
    // ==========================================
    // ROLES & CONSTANTS
    // ==========================================
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REWARDS_MANAGER_ROLE = keccak256("REWARDS_MANAGER_ROLE");
    
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18; // 100M CAPY
    uint256 public constant MAX_MINT_PER_TX = 1_000_000 * 10**18; // 1M CAPY
    uint256 public constant STAKING_REWARD_RATE = 100; // 1% ao dia (100/10000)
    uint256 public constant REFERRAL_BONUS = 100 * 10**18; // 100 CAPY por indicação
    uint256 public constant REFERRAL_COMMISSION = 500; // 5% (500/10000)
    uint256 public constant MIN_STAKE_AMOUNT = 10 * 10**18; // Mínimo 10 CAPY para stake

    // ==========================================
    // STRUCTS
    // ==========================================
    
    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 lastRewardClaim;
        uint256 totalRewardsClaimed;
    }
    
    struct UserStats {
        uint256 totalPoints;
        uint256 currentLevel; // 0-4 (Iniciante → Lendário)
        uint256 totalTransactions;
        uint256 totalReferrals;
        uint256 lastDailyLogin;
        bool isActive;
    }
    
    enum ActivityType { 
        TRANSACTION,    // PIX/Boleto (+10 CAPY)
        REFERRAL,       // Indicação (+100 CAPY)
        STAKING,        // Staking (+5 CAPY/dia)
        DAILY_LOGIN,    // Login diário (+2 CAPY)
        LEVEL_UP        // Subir nível (+50 CAPY)
    }

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    
    // Controle básico
    address public backendMinter;
    uint256 public totalMinted;
    
    // Sistema de Staking
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    
    // Sistema de Referral
    mapping(address => address) public referredBy;
    mapping(address => address[]) public referrals;
    mapping(address => uint256) public referralRewards;
    
    // Sistema de Pontos e Recompensas
    mapping(address => UserStats) public userStats;
    mapping(ActivityType => uint256) public activityRewards;
    mapping(address => mapping(ActivityType => uint256)) public lastActivityReward;
    
    // Níveis do sistema (alinhado com /points)
    uint256[] public levelThresholds;
    string[] public levelNames;
    
    // Estatísticas
    mapping(address => uint256) public mintedBy;
    mapping(address => uint256) public lastMintTimestamp;

    // ==========================================
    // EVENTS
    // ==========================================
    
    // Eventos básicos
    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    event TokensBurned(address indexed from, uint256 amount);
    event BackendMinterUpdated(address indexed oldMinter, address indexed newMinter);
    
    // Eventos de staking
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event StakingRewardClaimed(address indexed user, uint256 reward);
    
    // Eventos de referral
    event ReferralRegistered(address indexed referrer, address indexed referred);
    event ReferralRewardPaid(address indexed referrer, uint256 amount);
    event ReferralCommissionPaid(address indexed referrer, address indexed user, uint256 amount);
    
    // Eventos de recompensas
    event ActivityRewardClaimed(address indexed user, uint256 amount, ActivityType activity);
    event LevelUp(address indexed user, uint256 newLevel, uint256 bonus);
    event DailyLoginReward(address indexed user, uint256 reward);

    // ==========================================
    // MODIFIERS
    // ==========================================
    
    modifier withinSupplyLimit(uint256 amount) {
        require(totalSupply() + amount <= MAX_SUPPLY, "CapyCoin: Max supply exceeded");
        _;
    }
    
    modifier withinMintLimit(uint256 amount) {
        require(amount <= MAX_MINT_PER_TX, "CapyCoin: Mint amount exceeds per-tx limit");
        _;
    }
    
    modifier onlyActiveUser() {
        require(userStats[msg.sender].isActive || balanceOf(msg.sender) > 0, "CapyCoin: User not active");
        _;
    }

    // ==========================================
    // CONSTRUCTOR
    // ==========================================
    
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
        _grantRole(REWARDS_MANAGER_ROLE, _admin);
        _grantRole(REWARDS_MANAGER_ROLE, _backendMinter);
        
        backendMinter = _backendMinter;
        
        // Configurar níveis
        levelThresholds.push(0);      // Iniciante
        levelThresholds.push(2500);   // Explorador
        levelThresholds.push(5000);   // Comerciante
        levelThresholds.push(10000);  // Investidor
        levelThresholds.push(25000);  // Lendário
        
        // Configurar nomes dos níveis
        levelNames.push("Capivara Iniciante");
        levelNames.push("Capivara Explorador");
        levelNames.push("Capivara Comerciante");
        levelNames.push("Capivara Investidor");
        levelNames.push("Capivara Lendario");
        
        // Configurar recompensas (alinhado com frontend)
        activityRewards[ActivityType.TRANSACTION] = 10 * 10**18; // 10 CAPY por transação
        activityRewards[ActivityType.REFERRAL] = 100 * 10**18; // 100 CAPY por indicação
        activityRewards[ActivityType.STAKING] = 5 * 10**18; // 5 CAPY por dia de staking
        activityRewards[ActivityType.DAILY_LOGIN] = 2 * 10**18; // 2 CAPY por login diário
        activityRewards[ActivityType.LEVEL_UP] = 50 * 10**18; // 50 CAPY por subir de nível
        
        emit BackendMinterUpdated(address(0), _backendMinter);
    }

    // ==========================================
    // MINTING FUNCTIONS
    // ==========================================
    
    /**
     * @notice Minta tokens para um endereço específico
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
        
        // Ativar usuário se não estiver ativo
        if (!userStats[to].isActive) {
            userStats[to].isActive = true;
        }
        
        // Atualizar estatísticas
        totalMinted += amount;
        mintedBy[msg.sender] += amount;
        lastMintTimestamp[to] = block.timestamp;
        
        _mint(to, amount);
        emit TokensMinted(to, amount, msg.sender);
    }
    
    /**
     * @notice Minta tokens em lote para múltiplos endereços
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
        require(recipients.length > 0 && recipients.length <= 100, "CapyCoin: Invalid array length");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "CapyCoin: Cannot mint to zero address");
            require(amounts[i] > 0, "CapyCoin: Amount must be greater than zero");
            totalAmount += amounts[i];
        }
        
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "CapyCoin: Max supply exceeded");
        require(totalAmount <= MAX_MINT_PER_TX * 10, "CapyCoin: Total mint exceeds batch limit");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (!userStats[recipients[i]].isActive) {
                userStats[recipients[i]].isActive = true;
            }
            
            _mint(recipients[i], amounts[i]);
            lastMintTimestamp[recipients[i]] = block.timestamp;
            emit TokensMinted(recipients[i], amounts[i], msg.sender);
        }
        
        totalMinted += totalAmount;
        mintedBy[msg.sender] += totalAmount;
    }

    // ==========================================
    // REWARDS SYSTEM
    // ==========================================
    
    /**
     * @notice Reivindica recompensa por atividade
     * @param activity Tipo de atividade realizada
     */
    function claimActivityReward(ActivityType activity) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyActiveUser 
    {
        uint256 reward = activityRewards[activity];
        require(reward > 0, "CapyCoin: No reward for this activity");
        
        // Verificar cooldowns específicos
        if (activity == ActivityType.DAILY_LOGIN) {
            require(
                block.timestamp >= userStats[msg.sender].lastDailyLogin + 20 hours,
                "CapyCoin: Daily login cooldown active"
            );
            userStats[msg.sender].lastDailyLogin = block.timestamp;
            emit DailyLoginReward(msg.sender, reward);
        } else if (activity == ActivityType.TRANSACTION) {
            require(
                block.timestamp >= lastActivityReward[msg.sender][activity] + 5 minutes,
                "CapyCoin: Transaction cooldown active"
            );
            lastActivityReward[msg.sender][activity] = block.timestamp;
        } else {
            require(
                block.timestamp >= lastActivityReward[msg.sender][activity] + 1 hours,
                "CapyCoin: Activity cooldown active"
            );
            lastActivityReward[msg.sender][activity] = block.timestamp;
        }
        
        // Atualizar estatísticas do usuário
        userStats[msg.sender].totalPoints += reward;
        if (activity == ActivityType.TRANSACTION) {
            userStats[msg.sender].totalTransactions++;
        }
        
        // Verificar se subiu de nível
        _checkLevelUp(msg.sender);
        
        // Mintar recompensa
        _mint(msg.sender, reward);
        emit ActivityRewardClaimed(msg.sender, reward, activity);
    }
    
    /**
     * @notice Verifica e processa subida de nível
     * @param user Endereço do usuário
     */
    function _checkLevelUp(address user) internal {
        UserStats storage stats = userStats[user];
        uint256 currentLevel = stats.currentLevel;
        
        // Verificar se pode subir de nível
        for (uint256 i = currentLevel + 1; i < levelThresholds.length; i++) {
            if (stats.totalPoints >= levelThresholds[i]) {
                stats.currentLevel = i;
                
                // Dar bônus por subir de nível
                uint256 levelBonus = activityRewards[ActivityType.LEVEL_UP] * i;
                _mint(user, levelBonus);
                
                emit LevelUp(user, i, levelBonus);
            } else {
                break;
            }
        }
    }

    // ==========================================
    // REFERRAL SYSTEM
    // ==========================================
    
    /**
     * @notice Registra um novo referral
     * @param referrer Endereço do usuário que indicou
     */
    function registerReferral(address referrer) external whenNotPaused nonReentrant {
        require(referrer != msg.sender, "CapyCoin: Cannot refer yourself");
        require(referrer != address(0), "CapyCoin: Invalid referrer");
        require(referredBy[msg.sender] == address(0), "CapyCoin: Already referred");
        require(userStats[referrer].isActive, "CapyCoin: Referrer not active");
        
        // Registrar referral
        referredBy[msg.sender] = referrer;
        referrals[referrer].push(msg.sender);
        userStats[referrer].totalReferrals++;
        
        // Ativar usuário referido
        if (!userStats[msg.sender].isActive) {
            userStats[msg.sender].isActive = true;
        }
        
        // Dar recompensa ao referrer
        _mint(referrer, REFERRAL_BONUS);
        referralRewards[referrer] += REFERRAL_BONUS;
        
        // Atualizar pontos do referrer
        userStats[referrer].totalPoints += REFERRAL_BONUS;
        _checkLevelUp(referrer);
        
        emit ReferralRegistered(referrer, msg.sender);
        emit ReferralRewardPaid(referrer, REFERRAL_BONUS);
    }
    
    /**
     * @notice Paga comissão de referral
     * @param user Usuário que realizou a transação
     * @param transactionAmount Valor da transação em CAPY
     */
    function payReferralCommission(address user, uint256 transactionAmount) 
        external 
        onlyRole(REWARDS_MANAGER_ROLE) 
        whenNotPaused 
    {
        address referrer = referredBy[user];
        if (referrer != address(0) && transactionAmount > 0) {
            uint256 commission = (transactionAmount * REFERRAL_COMMISSION) / 10000;
            if (commission > 0 && totalSupply() + commission <= MAX_SUPPLY) {
                _mint(referrer, commission);
                referralRewards[referrer] += commission;
                emit ReferralCommissionPaid(referrer, user, commission);
            }
        }
    }

    // ==========================================
    // STAKING SYSTEM
    // ==========================================
    
    /**
     * @notice Faz stake de tokens CAPY
     * @param amount Quantidade de tokens para stake
     */
    function stake(uint256 amount) external whenNotPaused nonReentrant onlyActiveUser {
        require(amount >= MIN_STAKE_AMOUNT, "CapyCoin: Amount below minimum");
        require(balanceOf(msg.sender) >= amount, "CapyCoin: Insufficient balance");
        
        // Claim pending rewards first
        if (stakes[msg.sender].amount > 0) {
            _claimStakingRewards(msg.sender);
        }
        
        // Transfer tokens to contract
        _transfer(msg.sender, address(this), amount);
        
        // Update staking info
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].timestamp = block.timestamp;
        stakes[msg.sender].lastRewardClaim = block.timestamp;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @notice Remove tokens do stake
     * @param amount Quantidade de tokens para remover
     */
    function unstake(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "CapyCoin: Cannot unstake 0");
        require(stakes[msg.sender].amount >= amount, "CapyCoin: Insufficient staked");
        
        // Claim all pending rewards
        uint256 reward = _claimStakingRewards(msg.sender);
        
        // Update staking info
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;
        
        // Transfer tokens back
        _transfer(address(this), msg.sender, amount);
        
        emit Unstaked(msg.sender, amount, reward);
    }
    
    /**
     * @notice Reivindica recompensas de staking
     */
    function claimStakingRewards() external whenNotPaused nonReentrant returns (uint256) {
        require(stakes[msg.sender].amount > 0, "CapyCoin: No staking position");
        return _claimStakingRewards(msg.sender);
    }
    
    /**
     * @notice Processa recompensas de staking (interno)
     * @param user Endereço do usuário
     * @return reward Quantidade de recompensa
     */
    function _claimStakingRewards(address user) internal returns (uint256 reward) {
        reward = calculateStakingReward(user);
        if (reward > 0) {
            stakes[user].lastRewardClaim = block.timestamp;
            stakes[user].totalRewardsClaimed += reward;
            
            // Atualizar pontos
            userStats[user].totalPoints += reward;
            _checkLevelUp(user);
            
            _mint(user, reward);
            emit StakingRewardClaimed(user, reward);
        }
    }
    
    /**
     * @notice Calcula recompensas de staking pendentes
     * @param user Endereço do usuário
     * @return Quantidade de recompensa pendente
     */
    function calculateStakingReward(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;
        
        uint256 stakingDuration = block.timestamp - userStake.lastRewardClaim;
        uint256 dailyReward = (userStake.amount * STAKING_REWARD_RATE) / 10000;
        
        return (dailyReward * stakingDuration) / 1 days;
    }

    // ==========================================
    // BURNING FUNCTIONS
    // ==========================================
    
    /**
     * @notice Queima tokens do próprio saldo
     * @param amount Quantidade de tokens para queimar
     */
    function burn(uint256 amount) public override whenNotPaused nonReentrant {
        require(amount > 0, "CapyCoin: Burn amount must be greater than zero");
        super.burn(amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @notice Queima tokens de outro endereço (com aprovação)
     * @param from Endereço de onde queimar
     * @param amount Quantidade de tokens para queimar
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
     * @param newBackendMinter Novo endereço do backend
     */
    function updateBackendMinter(address newBackendMinter) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newBackendMinter != address(0), "CapyCoin: New minter cannot be zero address");
        require(newBackendMinter != backendMinter, "CapyCoin: Same minter address");
        
        address oldMinter = backendMinter;
        _revokeRole(MINTER_ROLE, oldMinter);
        _revokeRole(REWARDS_MANAGER_ROLE, oldMinter);
        _grantRole(MINTER_ROLE, newBackendMinter);
        _grantRole(REWARDS_MANAGER_ROLE, newBackendMinter);
        
        backendMinter = newBackendMinter;
        emit BackendMinterUpdated(oldMinter, newBackendMinter);
    }
    
    /**
     * @notice Atualiza recompensa de uma atividade
     * @param activity Tipo de atividade
     * @param newReward Nova quantidade de recompensa
     */
    function updateActivityReward(ActivityType activity, uint256 newReward) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newReward <= 1000 * 10**18, "CapyCoin: Reward too high");
        activityRewards[activity] = newReward;
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
    // VIEW FUNCTIONS
    // ==========================================
    
    /**
     * @notice Obtém informações completas do usuário
     * @param user Endereço do usuário
     * @return stats Estatísticas do usuário
     * @return stakeInfo Informações de staking
     * @return stakingReward Recompensas pendentes
     * @return referrer Quem indicou
     * @return referralCount Quantidade de indicados
     */
    function getUserInfo(address user) 
        external 
        view 
        returns (
            UserStats memory stats,
            StakeInfo memory stakeInfo,
            uint256 stakingReward,
            address referrer,
            uint256 referralCount
        ) 
    {
        return (
            userStats[user],
            stakes[user],
            calculateStakingReward(user),
            referredBy[user],
            referrals[user].length
        );
    }
    
    /**
     * @notice Obtém informações de nível do usuário
     * @param user Endereço do usuário
     * @return currentLevel Nível atual
     * @return currentPoints Pontos atuais
     * @return pointsToNextLevel Pontos para próximo nível
     * @return levelName Nome do nível
     */
    function getLevelInfo(address user) 
        external 
        view 
        returns (
            uint256 currentLevel,
            uint256 currentPoints,
            uint256 pointsToNextLevel,
            string memory levelName
        ) 
    {
        UserStats memory stats = userStats[user];
        currentLevel = stats.currentLevel;
        currentPoints = stats.totalPoints;
        
        if (currentLevel < levelThresholds.length - 1) {
            pointsToNextLevel = levelThresholds[currentLevel + 1] - currentPoints;
        } else {
            pointsToNextLevel = 0;
        }
        
        levelName = levelNames[currentLevel];
    }
    
    /**
     * @notice Obtém informações de staking
     * @return totalStakedAmount Total em stake
     * @return rewardRate Taxa de recompensa
     * @return userStaked Quantidade do usuário
     * @return userReward Recompensa do usuário
     */
    function getStakingInfo() 
        external 
        view 
        returns (
            uint256 totalStakedAmount,
            uint256 rewardRate,
            uint256 userStaked,
            uint256 userReward
        ) 
    {
        return (
            totalStaked,
            STAKING_REWARD_RATE,
            stakes[msg.sender].amount,
            calculateStakingReward(msg.sender)
        );
    }
    
    /**
     * @notice Obtém informações de referral
     * @param user Endereço do usuário
     * @return referrer Quem indicou
     * @return referredUsers Lista de indicados
     * @return totalRewards Total de recompensas
     * @return totalReferrals Total de indicações
     */
    function getReferralInfo(address user) 
        external 
        view 
        returns (
            address referrer,
            address[] memory referredUsers,
            uint256 totalRewards,
            uint256 totalReferrals
        ) 
    {
        return (
            referredBy[user],
            referrals[user],
            referralRewards[user],
            userStats[user].totalReferrals
        );
    }
    
    /**
     * @notice Verifica se um endereço pode mintar
     * @param account Endereço para verificar
     * @return bool Se pode mintar
     */
    function canMint(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account) && !paused();
    }
    
    /**
     * @notice Retorna o supply restante
     * @return uint256 Quantidade restante
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
    
    /**
     * @notice Retorna informações do token
     * @return name Nome do token
     * @return symbol Símbolo
     * @return decimals Decimais
     * @return totalSupply Supply atual
     * @return maxSupply Supply máximo
     */
    function tokenInfo() 
        external 
        view 
        returns (
            string memory,
            string memory,
            uint8,
            uint256,
            uint256
        ) 
    {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY
        );
    }

    // ==========================================
    // OVERRIDES
    // ==========================================
    
    /**
     * @notice Override para pausar transferências
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
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ==========================================
    // EMERGENCY FUNCTIONS
    // ==========================================
    
    /**
     * @notice Recupera tokens ERC20 enviados por engano
     * @param token Endereço do token
     * @param amount Quantidade para recuperar
     */
    function emergencyRecoverERC20(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(this), "CapyCoin: Cannot recover own tokens");
        require(token != address(0), "CapyCoin: Invalid token address");
        
        IERC20(token).transfer(msg.sender, amount);
    }
    
    /**
     * @notice Retira staking de emergência
     * @param user Endereço do usuário
     */
    function emergencyWithdrawStaking(address user) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        uint256 stakedAmount = stakes[user].amount;
        require(stakedAmount > 0, "CapyCoin: No staking position");
        
        stakes[user].amount = 0;
        totalStaked -= stakedAmount;
        
        _transfer(address(this), user, stakedAmount);
    }
}
