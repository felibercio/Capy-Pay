// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DepositRegistry
 * @dev Registro simples onchain para depósitos PIX (apenas eventos)
 */
contract DepositRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant RECORD_ROLE = keccak256("RECORD_ROLE");

    event PixDepositRecorded(
        bytes32 indexed depositId,
        address indexed user,
        uint256 amountInCents,
        string externalId,
        uint256 timestamp
    );

    constructor(address admin, address recorder) {
        require(admin != address(0), "Admin cannot be zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (recorder != address(0)) {
            _grantRole(RECORD_ROLE, recorder);
        }
    }

    /**
     * @notice Registra um depósito PIX onchain emitindo evento
     */
    function recordPixDeposit(
        bytes32 depositId,
        address user,
        uint256 amountInCents,
        string memory externalId
    ) external nonReentrant onlyRole(RECORD_ROLE) {
        require(user != address(0), "User cannot be zero");
        require(amountInCents > 0, "Amount must be > 0");

        emit PixDepositRecorded(depositId, user, amountInCents, externalId, block.timestamp);
    }
}