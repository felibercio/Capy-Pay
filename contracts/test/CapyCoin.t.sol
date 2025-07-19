// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/CapyCoin.sol";

/**
 * @title CapyCoinTest
 * @dev Testes completos para o contrato CapyCoin
 */
contract CapyCoinTest is Test {
    // ==========================================
    // STATE VARIABLES
    // ==========================================
    
    CapyCoin public capyCoin;
    
    // Endereços de teste
    address public admin = makeAddr("admin");
    address public backendMinter = makeAddr("backendMinter");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public nonMinter = makeAddr("nonMinter");
    
    // Constantes para testes
    uint256 public constant INITIAL_MINT = 1000 * 10**18; // 1000 CAPY
    uint256 public constant LARGE_MINT = 500000 * 10**18; // 500k CAPY
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18; // 100M CAPY
    uint256 public constant MAX_MINT_PER_TX = 1_000_000 * 10**18; // 1M CAPY

    // ==========================================
    // EVENTS (para testing)
    // ==========================================
    
    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    event TokensBurned(address indexed from, uint256 amount);
    event BackendMinterUpdated(address indexed oldMinter, address indexed newMinter);

    // ==========================================
    // SETUP
    // ==========================================
    
    function setUp() public {
        // Deploy do contrato
        capyCoin = new CapyCoin(backendMinter, admin);
        
        // Verificar setup inicial
        assertEq(capyCoin.name(), "Capy Coin");
        assertEq(capyCoin.symbol(), "CAPY");
        assertEq(capyCoin.decimals(), 18);
        assertEq(capyCoin.totalSupply(), 0);
        assertEq(capyCoin.backendMinter(), backendMinter);
        
        // Verificar roles
        assertTrue(capyCoin.hasRole(capyCoin.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(capyCoin.hasRole(capyCoin.MINTER_ROLE(), backendMinter));
        assertTrue(capyCoin.hasRole(capyCoin.PAUSER_ROLE(), admin));
    }

    // ==========================================
    // BASIC FUNCTIONALITY TESTS
    // ==========================================
    
    function testInitialState() public view {
        // Verificar estado inicial
        (
            string memory name,
            string memory symbol,
            uint8 decimals,
            uint256 totalSupply,
            uint256 maxSupply,
            uint256 totalMinted
        ) = capyCoin.tokenInfo();
        
        assertEq(name, "Capy Coin");
        assertEq(symbol, "CAPY");
        assertEq(decimals, 18);
        assertEq(totalSupply, 0);
        assertEq(maxSupply, MAX_SUPPLY);
        assertEq(totalMinted, 0);
        
        assertEq(capyCoin.remainingSupply(), MAX_SUPPLY);
        assertTrue(capyCoin.canMint(backendMinter));
        assertFalse(capyCoin.canMint(nonMinter));
    }

    // ==========================================
    // MINTING TESTS
    // ==========================================
    
    function testMintByMinter() public {
        vm.startPrank(backendMinter);
        
        // Expectativa de evento
        vm.expectEmit(true, true, false, true);
        emit TokensMinted(user1, INITIAL_MINT, backendMinter);
        
        // Mintar tokens
        capyCoin.mint(user1, INITIAL_MINT);
        
        // Verificar resultados
        assertEq(capyCoin.balanceOf(user1), INITIAL_MINT);
        assertEq(capyCoin.totalSupply(), INITIAL_MINT);
        assertEq(capyCoin.totalMinted(), INITIAL_MINT);
        assertEq(capyCoin.mintedBy(backendMinter), INITIAL_MINT);
        assertEq(capyCoin.lastMintTimestamp(user1), block.timestamp);
        
        vm.stopPrank();
    }
    
    function testMintFailsForNonMinter() public {
        vm.startPrank(nonMinter);
        
        vm.expectRevert();
        capyCoin.mint(user1, INITIAL_MINT);
        
        vm.stopPrank();
    }
    
    function testMintFailsForZeroAddress() public {
        vm.startPrank(backendMinter);
        
        vm.expectRevert("CapyCoin: Cannot mint to zero address");
        capyCoin.mint(address(0), INITIAL_MINT);
        
        vm.stopPrank();
    }
    
    function testMintFailsForZeroAmount() public {
        vm.startPrank(backendMinter);
        
        vm.expectRevert("CapyCoin: Mint amount must be greater than zero");
        capyCoin.mint(user1, 0);
        
        vm.stopPrank();
    }
    
    function testMintFailsWhenExceedsMaxSupply() public {
        vm.startPrank(backendMinter);
        
        // Tentar mintar mais que o máximo
        vm.expectRevert("CapyCoin: Max supply exceeded");
        capyCoin.mint(user1, MAX_SUPPLY + 1);
        
        vm.stopPrank();
    }
    
    function testMintFailsWhenExceedsPerTxLimit() public {
        vm.startPrank(backendMinter);
        
        vm.expectRevert("CapyCoin: Mint amount exceeds per-tx limit");
        capyCoin.mint(user1, MAX_MINT_PER_TX + 1);
        
        vm.stopPrank();
    }
    
    function testBatchMint() public {
        vm.startPrank(backendMinter);
        
        address[] memory recipients = new address[](3);
        uint256[] memory amounts = new uint256[](3);
        
        recipients[0] = user1;
        recipients[1] = user2;
        recipients[2] = user3;
        
        amounts[0] = 1000 * 10**18;
        amounts[1] = 2000 * 10**18;
        amounts[2] = 3000 * 10**18;
        
        uint256 totalAmount = 6000 * 10**18;
        
        // Executar batch mint
        capyCoin.batchMint(recipients, amounts);
        
        // Verificar resultados
        assertEq(capyCoin.balanceOf(user1), amounts[0]);
        assertEq(capyCoin.balanceOf(user2), amounts[1]);
        assertEq(capyCoin.balanceOf(user3), amounts[2]);
        assertEq(capyCoin.totalSupply(), totalAmount);
        assertEq(capyCoin.totalMinted(), totalAmount);
        
        vm.stopPrank();
    }
    
    function testBatchMintFailsWithMismatchedArrays() public {
        vm.startPrank(backendMinter);
        
        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](3);
        
        vm.expectRevert("CapyCoin: Arrays length mismatch");
        capyCoin.batchMint(recipients, amounts);
        
        vm.stopPrank();
    }

    // ==========================================
    // BURNING TESTS
    // ==========================================
    
    function testBurn() public {
        // Primeiro mintar alguns tokens
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        // Usuário queima tokens
        vm.startPrank(user1);
        
        uint256 burnAmount = 500 * 10**18;
        
        vm.expectEmit(true, false, false, true);
        emit TokensBurned(user1, burnAmount);
        
        capyCoin.burn(burnAmount);
        
        assertEq(capyCoin.balanceOf(user1), INITIAL_MINT - burnAmount);
        assertEq(capyCoin.totalSupply(), INITIAL_MINT - burnAmount);
        
        vm.stopPrank();
    }
    
    function testBurnFrom() public {
        // Mintar tokens para user1
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        // user1 aprova user2 a queimar tokens
        vm.prank(user1);
        capyCoin.approve(user2, 500 * 10**18);
        
        // user2 queima tokens de user1
        vm.startPrank(user2);
        
        uint256 burnAmount = 300 * 10**18;
        capyCoin.burnFrom(user1, burnAmount);
        
        assertEq(capyCoin.balanceOf(user1), INITIAL_MINT - burnAmount);
        assertEq(capyCoin.allowance(user1, user2), 500 * 10**18 - burnAmount);
        
        vm.stopPrank();
    }
    
    function testBurnFailsForZeroAmount() public {
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        vm.startPrank(user1);
        
        vm.expectRevert("CapyCoin: Burn amount must be greater than zero");
        capyCoin.burn(0);
        
        vm.stopPrank();
    }

    // ==========================================
    // TRANSFER TESTS
    // ==========================================
    
    function testTransfer() public {
        // Mintar tokens para user1
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        // user1 transfere para user2
        vm.startPrank(user1);
        
        uint256 transferAmount = 250 * 10**18;
        capyCoin.transfer(user2, transferAmount);
        
        assertEq(capyCoin.balanceOf(user1), INITIAL_MINT - transferAmount);
        assertEq(capyCoin.balanceOf(user2), transferAmount);
        
        vm.stopPrank();
    }
    
    function testTransferFrom() public {
        // Mintar tokens para user1
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        // user1 aprova user2
        vm.prank(user1);
        capyCoin.approve(user2, 400 * 10**18);
        
        // user2 transfere de user1 para user3
        vm.startPrank(user2);
        
        uint256 transferAmount = 200 * 10**18;
        capyCoin.transferFrom(user1, user3, transferAmount);
        
        assertEq(capyCoin.balanceOf(user1), INITIAL_MINT - transferAmount);
        assertEq(capyCoin.balanceOf(user3), transferAmount);
        assertEq(capyCoin.allowance(user1, user2), 400 * 10**18 - transferAmount);
        
        vm.stopPrank();
    }

    // ==========================================
    // ADMIN FUNCTIONS TESTS
    // ==========================================
    
    function testUpdateBackendMinter() public {
        address newMinter = makeAddr("newMinter");
        
        vm.startPrank(admin);
        
        vm.expectEmit(true, true, false, false);
        emit BackendMinterUpdated(backendMinter, newMinter);
        
        capyCoin.updateBackendMinter(newMinter);
        
        assertEq(capyCoin.backendMinter(), newMinter);
        assertTrue(capyCoin.hasRole(capyCoin.MINTER_ROLE(), newMinter));
        assertFalse(capyCoin.hasRole(capyCoin.MINTER_ROLE(), backendMinter));
        
        vm.stopPrank();
    }
    
    function testUpdateBackendMinterFailsForNonAdmin() public {
        address newMinter = makeAddr("newMinter");
        
        vm.startPrank(nonMinter);
        
        vm.expectRevert();
        capyCoin.updateBackendMinter(newMinter);
        
        vm.stopPrank();
    }
    
    function testUpdateBackendMinterFailsForZeroAddress() public {
        vm.startPrank(admin);
        
        vm.expectRevert("CapyCoin: New minter cannot be zero address");
        capyCoin.updateBackendMinter(address(0));
        
        vm.stopPrank();
    }
    
    function testUpdateBackendMinterFailsForSameAddress() public {
        vm.startPrank(admin);
        
        vm.expectRevert("CapyCoin: Same minter address");
        capyCoin.updateBackendMinter(backendMinter);
        
        vm.stopPrank();
    }

    // ==========================================
    // PAUSABLE TESTS
    // ==========================================
    
    function testPause() public {
        vm.startPrank(admin);
        
        capyCoin.pause();
        assertTrue(capyCoin.paused());
        
        vm.stopPrank();
    }
    
    function testUnpause() public {
        vm.startPrank(admin);
        
        capyCoin.pause();
        capyCoin.unpause();
        assertFalse(capyCoin.paused());
        
        vm.stopPrank();
    }
    
    function testMintFailsWhenPaused() public {
        vm.prank(admin);
        capyCoin.pause();
        
        vm.startPrank(backendMinter);
        
        vm.expectRevert("Pausable: paused");
        capyCoin.mint(user1, INITIAL_MINT);
        
        vm.stopPrank();
    }
    
    function testTransferFailsWhenPaused() public {
        // Primeiro mintar
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        // Pausar
        vm.prank(admin);
        capyCoin.pause();
        
        // Tentar transferir
        vm.startPrank(user1);
        
        vm.expectRevert("Pausable: paused");
        capyCoin.transfer(user2, 100 * 10**18);
        
        vm.stopPrank();
    }
    
    function testPauseFailsForNonPauser() public {
        vm.startPrank(nonMinter);
        
        vm.expectRevert();
        capyCoin.pause();
        
        vm.stopPrank();
    }

    // ==========================================
    // VIEW FUNCTIONS TESTS
    // ==========================================
    
    function testGetMinterStats() public {
        // Mintar alguns tokens
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        (uint256 totalMintedByMinter, bool canMintNow) = capyCoin.getMinterStats(backendMinter);
        
        assertEq(totalMintedByMinter, INITIAL_MINT);
        assertTrue(canMintNow);
        
        // Verificar para não-minter
        (uint256 totalMintedByNonMinter, bool canMintNonMinter) = capyCoin.getMinterStats(nonMinter);
        
        assertEq(totalMintedByNonMinter, 0);
        assertFalse(canMintNonMinter);
    }
    
    function testRemainingSupply() public {
        assertEq(capyCoin.remainingSupply(), MAX_SUPPLY);
        
        // Mintar alguns tokens
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        assertEq(capyCoin.remainingSupply(), MAX_SUPPLY - INITIAL_MINT);
    }

    // ==========================================
    // EMERGENCY FUNCTIONS TESTS
    // ==========================================
    
    function testEmergencyRecoverERC20() public {
        // Deploy um token mock para teste
        CapyCoin mockToken = new CapyCoin(admin, admin);
        
        // Mintar alguns tokens mock para o contrato principal
        vm.prank(admin);
        mockToken.mint(address(capyCoin), 1000 * 10**18);
        
        uint256 initialBalance = mockToken.balanceOf(admin);
        
        // Recuperar tokens
        vm.startPrank(admin);
        
        capyCoin.emergencyRecoverERC20(address(mockToken), 500 * 10**18);
        
        assertEq(mockToken.balanceOf(admin), initialBalance + 500 * 10**18);
        assertEq(mockToken.balanceOf(address(capyCoin)), 500 * 10**18);
        
        vm.stopPrank();
    }
    
    function testEmergencyRecoverFailsForOwnTokens() public {
        vm.startPrank(admin);
        
        vm.expectRevert("CapyCoin: Cannot recover own tokens");
        capyCoin.emergencyRecoverERC20(address(capyCoin), 100);
        
        vm.stopPrank();
    }

    // ==========================================
    // FUZZ TESTS
    // ==========================================
    
    function testFuzzMint(uint256 amount) public {
        // Limitar amount para valores válidos
        vm.assume(amount > 0 && amount <= MAX_MINT_PER_TX && amount <= MAX_SUPPLY);
        
        vm.prank(backendMinter);
        capyCoin.mint(user1, amount);
        
        assertEq(capyCoin.balanceOf(user1), amount);
        assertEq(capyCoin.totalSupply(), amount);
    }
    
    function testFuzzTransfer(uint256 mintAmount, uint256 transferAmount) public {
        // Limitar valores
        vm.assume(mintAmount > 0 && mintAmount <= MAX_MINT_PER_TX);
        vm.assume(transferAmount <= mintAmount);
        
        // Mintar
        vm.prank(backendMinter);
        capyCoin.mint(user1, mintAmount);
        
        // Transferir
        vm.prank(user1);
        capyCoin.transfer(user2, transferAmount);
        
        assertEq(capyCoin.balanceOf(user1), mintAmount - transferAmount);
        assertEq(capyCoin.balanceOf(user2), transferAmount);
    }

    // ==========================================
    // INVARIANT TESTS
    // ==========================================
    
    function invariantTotalSupplyNeverExceedsMaxSupply() public view {
        assertLe(capyCoin.totalSupply(), MAX_SUPPLY);
    }
    
    function invariantTotalMintedEqualsOrExceedsTotalSupply() public view {
        assertGe(capyCoin.totalMinted(), capyCoin.totalSupply());
    }

    // ==========================================
    // INTEGRATION TESTS
    // ==========================================
    
    function testCompleteUserJourney() public {
        // 1. Mintar tokens para user1
        vm.prank(backendMinter);
        capyCoin.mint(user1, INITIAL_MINT);
        
        // 2. user1 transfere para user2
        vm.prank(user1);
        capyCoin.transfer(user2, 300 * 10**18);
        
        // 3. user2 aprova user3
        vm.prank(user2);
        capyCoin.approve(user3, 100 * 10**18);
        
        // 4. user3 transfere de user2 para si mesmo
        vm.prank(user3);
        capyCoin.transferFrom(user2, user3, 50 * 10**18);
        
        // 5. user1 queima alguns tokens
        vm.prank(user1);
        capyCoin.burn(200 * 10**18);
        
        // Verificar estado final
        assertEq(capyCoin.balanceOf(user1), 500 * 10**18); // 1000 - 300 - 200
        assertEq(capyCoin.balanceOf(user2), 250 * 10**18); // 300 - 50
        assertEq(capyCoin.balanceOf(user3), 50 * 10**18);
        assertEq(capyCoin.totalSupply(), 800 * 10**18); // 1000 - 200 (burned)
        assertEq(capyCoin.allowance(user2, user3), 50 * 10**18); // 100 - 50
    }
} 