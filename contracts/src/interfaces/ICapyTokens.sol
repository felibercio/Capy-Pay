// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title ICapyCoin
 * @dev Interface para o token CapyCoin
 */
interface ICapyCoin is IERC20, IAccessControl {
    // ==========================================
    // EVENTS
    // ==========================================
    
    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    event TokensBurned(address indexed from, uint256 amount);
    event BackendMinterUpdated(address indexed oldMinter, address indexed newMinter);

    // ==========================================
    // CONSTANTS
    // ==========================================
    
    function MAX_SUPPLY() external view returns (uint256);
    function MAX_MINT_PER_TX() external view returns (uint256);

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    
    function backendMinter() external view returns (address);
    function totalMinted() external view returns (uint256);
    function mintedBy(address minter) external view returns (uint256);
    function lastMintTimestamp(address user) external view returns (uint256);

    // ==========================================
    // MINTING FUNCTIONS
    // ==========================================
    
    function mint(address to, uint256 amount) external;
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external;

    // ==========================================
    // ADMIN FUNCTIONS
    // ==========================================
    
    function updateBackendMinter(address newBackendMinter) external;
    function pause() external;
    function unpause() external;

    // ==========================================
    // VIEW FUNCTIONS
    // ==========================================
    
    function tokenInfo() external view returns (
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        uint256 maxSupply,
        uint256 totalMinted
    );
    
    function canMint(address account) external view returns (bool);
    function remainingSupply() external view returns (uint256);
    function getMinterStats(address minter) external view returns (uint256 totalMinted, bool canMintNow);

    // ==========================================
    // EMERGENCY FUNCTIONS
    // ==========================================
    
    function emergencyRecoverERC20(address token, uint256 amount) external;
}

/**
 * @title IBRcapy
 * @dev Interface para o token BRcapy (Yieldcoin)
 */
interface IBRcapy is IERC20, IAccessControl {
    // ==========================================
    // STRUCTS
    // ==========================================
    
    struct ValueHistory {
        uint256 value;
        uint256 cdiRate;
        uint256 internalFee;
        uint256 apy;
        uint256 timestamp;
        uint256 totalSupply;
        address updatedBy;
    }

    // ==========================================
    // EVENTS
    // ==========================================
    
    event ValueUpdated(
        uint256 indexed historyIndex,
        uint256 oldValue,
        uint256 newValue,
        uint256 cdiRate,
        uint256 internalFee,
        uint256 apy,
        address indexed updatedBy
    );
    
    event TokensMinted(
        address indexed to,
        uint256 tokenAmount,
        uint256 brlValue,
        uint256 currentValue
    );
    
    event TokensBurned(
        address indexed from,
        uint256 tokenAmount,
        uint256 brlValue,
        uint256 currentValue
    );
    
    event BackendUpdaterChanged(address indexed oldUpdater, address indexed newUpdater);
    event YieldCalculated(address indexed user, uint256 yieldAmount, uint256 period);

    // ==========================================
    // CONSTANTS
    // ==========================================
    
    function MAX_SUPPLY() external view returns (uint256);
    function PRECISION() external view returns (uint256);
    function MAX_VALUE_CHANGE_BPS() external view returns (uint256);
    function BASIS_POINTS() external view returns (uint256);
    function MIN_UPDATE_INTERVAL() external view returns (uint256);

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    
    function currentValue() external view returns (uint256);
    function cdiRate() external view returns (uint256);
    function internalFeeRate() external view returns (uint256);
    function currentAPY() external view returns (uint256);
    function lastValueUpdate() external view returns (uint256);
    function backendUpdater() external view returns (address);
    function totalValueBRL() external view returns (uint256);
    function historyCount() external view returns (uint256);
    function accumulatedYield(address user) external view returns (uint256);
    function userEntryTimestamp(address user) external view returns (uint256);

    // ==========================================
    // VALUE UPDATE FUNCTIONS
    // ==========================================
    
    function updateValue(
        uint256 newValue,
        uint256 newCdiRate,
        uint256 newInternalFeeRate
    ) external;

    // ==========================================
    // MINTING AND BURNING FUNCTIONS
    // ==========================================
    
    function mintFromBRL(address to, uint256 brlAmount) external;
    function burnToBRL(uint256 tokenAmount) external returns (uint256 brlValue);
    function mint(address to, uint256 tokenAmount) external;

    // ==========================================
    // CONVERSION FUNCTIONS
    // ==========================================
    
    function tokensToBRL(uint256 tokenAmount) external view returns (uint256 brlValue);
    function brlToTokens(uint256 brlAmount) external view returns (uint256 tokenAmount);

    // ==========================================
    // YIELD CALCULATION FUNCTIONS
    // ==========================================
    
    function calculateYield(address user) external view returns (uint256 yieldAmount, uint256 yieldValueBRL);
    function calculateEffectiveAPY(uint256 startTimestamp, uint256 endTimestamp) external view returns (uint256 effectiveAPY);

    // ==========================================
    // HISTORY FUNCTIONS
    // ==========================================
    
    function valueHistory(uint256 index) external view returns (ValueHistory memory);
    function getValueHistory(uint256 index) external view returns (ValueHistory memory);
    function getRecentHistory(uint256 count) external view returns (ValueHistory[] memory);

    // ==========================================
    // VIEW FUNCTIONS
    // ==========================================
    
    function tokenInfo() external view returns (
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
    );

    // ==========================================
    // ADMIN FUNCTIONS
    // ==========================================
    
    function updateBackendUpdater(address newUpdater) external;
    function pause() external;
    function unpause() external;

    // ==========================================
    // EMERGENCY FUNCTIONS
    // ==========================================
    
    function emergencyRecoverERC20(address token, uint256 amount) external;
}

/**
 * @title ICapyTokensFactory
 * @dev Interface para factory de tokens Capy (futuro)
 */
interface ICapyTokensFactory {
    event CapyCoinDeployed(address indexed capyCoin, address indexed admin, address indexed minter);
    event BRcapyDeployed(address indexed brcapy, address indexed admin, address indexed updater);
    
    function deployCapyCoin(
        address admin,
        address minter
    ) external returns (address capyCoin);
    
    function deployBRcapy(
        uint256 initialValue,
        uint256 cdiRate,
        uint256 internalFeeRate,
        address admin,
        address updater
    ) external returns (address brcapy);
    
    function getDeployedTokens() external view returns (
        address[] memory capyCoins,
        address[] memory brcapys
    );
} 