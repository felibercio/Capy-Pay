// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/BRcapy.sol";

/**
 * @title BRcapyTest
 * @dev Testes completos para o contrato BRcapy
 */
contract BRcapyTest is Test {
    // ==========================================
    // STATE VARIABLES
    // ==========================================
    
    BRcapy public brcapy;
    
    // Endereços de teste
    address public admin = makeAddr("admin");
    address public backendUpdater = makeAddr("backendUpdater");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public nonUpdater = makeAddr("nonUpdater");
    
    // Valores iniciais para testes
    uint256 public constant INITIAL_VALUE = 1.05234567 * 10**18; // 1.05234567 BRL
    uint256 public constant INITIAL_CDI_RATE = 1175; // 11.75%
    uint256 public constant INITIAL_INTERNAL_FEE = 110; // 1.10%
    uint256 public constant INITIAL_APY = INITIAL_CDI_RATE - INITIAL_INTERNAL_FEE; // 10.65%
    
    uint256 public constant PRECISION = 10**18;
    uint256 public constant MAX_SUPPLY = 50_000_000 * 10**18;
    uint256 public constant BASIS_POINTS = 10000;

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

    // ==========================================
    // SETUP
    // ==========================================
    
    function setUp() public {
        // Deploy do contrato
        brcapy = new BRcapy(
            INITIAL_VALUE,
            INITIAL_CDI_RATE,
            INITIAL_INTERNAL_FEE,
            backendUpdater,
            admin
        );
        
        // Verificar setup inicial
        assertEq(brcapy.name(), "BRcapy");
        assertEq(brcapy.symbol(), "BRCAPY");
        assertEq(brcapy.decimals(), 18);
        assertEq(brcapy.totalSupply(), 0);
        assertEq(brcapy.currentValue(), INITIAL_VALUE);
        assertEq(brcapy.cdiRate(), INITIAL_CDI_RATE);
        assertEq(brcapy.internalFeeRate(), INITIAL_INTERNAL_FEE);
        assertEq(brcapy.currentAPY(), INITIAL_APY);
        assertEq(brcapy.backendUpdater(), backendUpdater);
        assertEq(brcapy.historyCount(), 1);
        
        // Verificar roles
        assertTrue(brcapy.hasRole(brcapy.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(brcapy.hasRole(brcapy.VALUE_UPDATER_ROLE(), backendUpdater));
        assertTrue(brcapy.hasRole(brcapy.MINTER_ROLE(), backendUpdater));
        assertTrue(brcapy.hasRole(brcapy.PAUSER_ROLE(), admin));
    }

    // ==========================================
    // INITIAL STATE TESTS
    // ==========================================
    
    function testInitialState() public view {
        (
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
        ) = brcapy.tokenInfo();
        
        assertEq(name, "BRcapy");
        assertEq(symbol, "BRCAPY");
        assertEq(decimals, 18);
        assertEq(totalSupply, 0);
        assertEq(maxSupply, MAX_SUPPLY);
        assertEq(currentValue, INITIAL_VALUE);
        assertEq(totalValueBRL, 0);
        assertEq(currentAPY, INITIAL_APY);
        assertEq(cdiRate, INITIAL_CDI_RATE);
        assertEq(internalFeeRate, INITIAL_INTERNAL_FEE);
    }
    
    function testInitialHistory() public view {
        assertEq(brcapy.historyCount(), 1);
        
        BRcapy.ValueHistory memory history = brcapy.getValueHistory(0);
        assertEq(history.value, INITIAL_VALUE);
        assertEq(history.cdiRate, INITIAL_CDI_RATE);
        assertEq(history.internalFee, INITIAL_INTERNAL_FEE);
        assertEq(history.apy, INITIAL_APY);
        assertEq(history.totalSupply, 0);
        assertEq(history.updatedBy, admin);
    }

    // ==========================================
    // VALUE UPDATE TESTS
    // ==========================================
    
    function testUpdateValue() public {
        uint256 newValue = 1.06 * 10**18;
        uint256 newCdiRate = 1200;
        uint256 newInternalFee = 115;
        uint256 expectedAPY = newCdiRate - newInternalFee;
        
        // Avançar tempo para permitir atualização
        vm.warp(block.timestamp + 2 hours);
        
        vm.startPrank(backendUpdater);
        
        vm.expectEmit(true, false, false, true);
        emit ValueUpdated(
            1, // historyIndex
            INITIAL_VALUE, // oldValue
            newValue, // newValue
            newCdiRate,
            newInternalFee,
            expectedAPY,
            backendUpdater
        );
        
        brcapy.updateValue(newValue, newCdiRate, newInternalFee);
        
        // Verificar atualizações
        assertEq(brcapy.currentValue(), newValue);
        assertEq(brcapy.cdiRate(), newCdiRate);
        assertEq(brcapy.internalFeeRate(), newInternalFee);
        assertEq(brcapy.currentAPY(), expectedAPY);
        assertEq(brcapy.lastValueUpdate(), block.timestamp);
        assertEq(brcapy.historyCount(), 2);
        
        vm.stopPrank();
    }
    
    function testUpdateValueFailsForNonUpdater() public {
        vm.warp(block.timestamp + 2 hours);
        
        vm.startPrank(nonUpdater);
        
        vm.expectRevert();
        brcapy.updateValue(1.06 * 10**18, 1200, 115);
        
        vm.stopPrank();
    }
    
    function testUpdateValueFailsForZeroValue() public {
        vm.warp(block.timestamp + 2 hours);
        
        vm.startPrank(backendUpdater);
        
        vm.expectRevert("BRcapy: New value must be greater than zero");
        brcapy.updateValue(0, 1200, 115);
        
        vm.stopPrank();
    }
    
    function testUpdateValueFailsWhenCDILessThanInternalFee() public {
        vm.warp(block.timestamp + 2 hours);
        
        vm.startPrank(backendUpdater);
        
        vm.expectRevert("BRcapy: CDI rate must be >= internal fee");
        brcapy.updateValue(1.06 * 10**18, 100, 200); // CDI < internal fee
        
        vm.stopPrank();
    }
    
    function testUpdateValueFailsWhenIntervalNotMet() public {
        vm.startPrank(backendUpdater);
        
        vm.expectRevert("BRcapy: Update interval not met");
        brcapy.updateValue(1.06 * 10**18, 1200, 115);
        
        vm.stopPrank();
    }
    
    function testUpdateValueFailsForLargeChange() public {
        vm.warp(block.timestamp + 2 hours);
        
        vm.startPrank(backendUpdater);
        
        // Tentar mudança de mais de 20%
        uint256 largeValue = INITIAL_VALUE * 125 / 100; // 25% de aumento
        
        vm.expectRevert("BRcapy: Value change too large");
        brcapy.updateValue(largeValue, 1200, 115);
        
        vm.stopPrank();
    }

    // ==========================================
    // MINTING TESTS
    // ==========================================
    
    function testMintFromBRL() public {
        uint256 brlAmount = 1000 * 10**18; // 1000 BRL
        uint256 expectedTokens = (brlAmount * PRECISION) / INITIAL_VALUE;
        
        vm.startPrank(backendUpdater);
        
        vm.expectEmit(true, false, false, true);
        emit TokensMinted(user1, expectedTokens, brlAmount, INITIAL_VALUE);
        
        brcapy.mintFromBRL(user1, brlAmount);
        
        assertEq(brcapy.balanceOf(user1), expectedTokens);
        assertEq(brcapy.totalSupply(), expectedTokens);
        assertEq(brcapy.userEntryTimestamp(user1), block.timestamp);
        assertEq(brcapy.totalValueBRL(), brlAmount);
        
        vm.stopPrank();
    }
    
    function testMintTokensDirectly() public {
        uint256 tokenAmount = 500 * 10**18;
        uint256 expectedBRLValue = (tokenAmount * INITIAL_VALUE) / PRECISION;
        
        vm.startPrank(backendUpdater);
        
        brcapy.mint(user1, tokenAmount);
        
        assertEq(brcapy.balanceOf(user1), tokenAmount);
        assertEq(brcapy.totalSupply(), tokenAmount);
        assertEq(brcapy.totalValueBRL(), expectedBRLValue);
        
        vm.stopPrank();
    }
    
    function testMintFailsForNonMinter() public {
        vm.startPrank(nonUpdater);
        
        vm.expectRevert();
        brcapy.mintFromBRL(user1, 1000 * 10**18);
        
        vm.stopPrank();
    }
    
    function testMintFailsForZeroAddress() public {
        vm.startPrank(backendUpdater);
        
        vm.expectRevert("BRcapy: Cannot mint to zero address");
        brcapy.mintFromBRL(address(0), 1000 * 10**18);
        
        vm.stopPrank();
    }
    
    function testMintFailsForZeroAmount() public {
        vm.startPrank(backendUpdater);
        
        vm.expectRevert("BRcapy: BRL amount must be greater than zero");
        brcapy.mintFromBRL(user1, 0);
        
        vm.stopPrank();
    }
    
    function testMintFailsWhenExceedsMaxSupply() public {
        vm.startPrank(backendUpdater);
        
        vm.expectRevert("BRcapy: Max supply exceeded");
        brcapy.mint(user1, MAX_SUPPLY + 1);
        
        vm.stopPrank();
    }

    // ==========================================
    // BURNING TESTS
    // ==========================================
    
    function testBurnToBRL() public {
        // Primeiro mintar tokens
        uint256 tokenAmount = 500 * 10**18;
        vm.prank(backendUpdater);
        brcapy.mint(user1, tokenAmount);
        
        // Queimar tokens
        vm.startPrank(user1);
        
        uint256 burnAmount = 200 * 10**18;
        uint256 expectedBRLValue = (burnAmount * INITIAL_VALUE) / PRECISION;
        
        vm.expectEmit(true, false, false, true);
        emit TokensBurned(user1, burnAmount, expectedBRLValue, INITIAL_VALUE);
        
        uint256 brlValue = brcapy.burnToBRL(burnAmount);
        
        assertEq(brlValue, expectedBRLValue);
        assertEq(brcapy.balanceOf(user1), tokenAmount - burnAmount);
        assertEq(brcapy.totalSupply(), tokenAmount - burnAmount);
        
        vm.stopPrank();
    }
    
    function testBurnFailsForZeroAmount() public {
        vm.prank(backendUpdater);
        brcapy.mint(user1, 500 * 10**18);
        
        vm.startPrank(user1);
        
        vm.expectRevert("BRcapy: Token amount must be greater than zero");
        brcapy.burnToBRL(0);
        
        vm.stopPrank();
    }
    
    function testBurnFailsForInsufficientBalance() public {
        vm.prank(backendUpdater);
        brcapy.mint(user1, 100 * 10**18);
        
        vm.startPrank(user1);
        
        vm.expectRevert("BRcapy: Insufficient balance");
        brcapy.burnToBRL(200 * 10**18);
        
        vm.stopPrank();
    }

    // ==========================================
    // CONVERSION TESTS
    // ==========================================
    
    function testTokensToBRL() public view {
        uint256 tokenAmount = 1000 * 10**18;
        uint256 expectedBRL = (tokenAmount * INITIAL_VALUE) / PRECISION;
        
        uint256 brlValue = brcapy.tokensToBRL(tokenAmount);
        assertEq(brlValue, expectedBRL);
    }
    
    function testBRLToTokens() public view {
        uint256 brlAmount = 1000 * 10**18;
        uint256 expectedTokens = (brlAmount * PRECISION) / INITIAL_VALUE;
        
        uint256 tokenAmount = brcapy.brlToTokens(brlAmount);
        assertEq(tokenAmount, expectedTokens);
    }
    
    function testConversionsWithZeroValue() public {
        // Deploy contrato com valor zero (não deveria acontecer, mas testando)
        vm.expectRevert("BRcapy: Initial value must be greater than zero");
        new BRcapy(0, INITIAL_CDI_RATE, INITIAL_INTERNAL_FEE, backendUpdater, admin);
    }

    // ==========================================
    // YIELD CALCULATION TESTS
    // ==========================================
    
    function testCalculateYield() public {
        // Mintar tokens para user1
        uint256 tokenAmount = 1000 * 10**18;
        vm.prank(backendUpdater);
        brcapy.mint(user1, tokenAmount);
        
        // Avançar tempo (1 ano)
        vm.warp(block.timestamp + 365 days);
        
        (uint256 yieldAmount, uint256 yieldValueBRL) = brcapy.calculateYield(user1);
        
        // Yield esperado: tokenAmount * APY * timeHeld / (BASIS_POINTS * annualSeconds)
        uint256 expectedYieldAmount = (tokenAmount * INITIAL_APY * 365 days) / (BASIS_POINTS * 365 days);
        expectedYieldAmount = (tokenAmount * INITIAL_APY) / BASIS_POINTS;
        
        uint256 expectedYieldValueBRL = (expectedYieldAmount * INITIAL_VALUE) / PRECISION;
        
        assertEq(yieldAmount, expectedYieldAmount);
        assertEq(yieldValueBRL, expectedYieldValueBRL);
    }
    
    function testCalculateYieldForZeroBalance() public view {
        (uint256 yieldAmount, uint256 yieldValueBRL) = brcapy.calculateYield(user1);
        
        assertEq(yieldAmount, 0);
        assertEq(yieldValueBRL, 0);
    }
    
    function testCalculateEffectiveAPY() public view {
        uint256 startTime = block.timestamp;
        uint256 endTime = block.timestamp + 30 days;
        
        uint256 effectiveAPY = brcapy.calculateEffectiveAPY(startTime, endTime);
        
        // Para MVP, deve retornar APY atual
        assertEq(effectiveAPY, INITIAL_APY);
    }
    
    function testCalculateEffectiveAPYFailsForInvalidRange() public {
        vm.expectRevert("BRcapy: Invalid timestamp range");
        brcapy.calculateEffectiveAPY(block.timestamp, block.timestamp - 1);
    }

    // ==========================================
    // HISTORY TESTS
    // ==========================================
    
    function testGetValueHistory() public {
        BRcapy.ValueHistory memory history = brcapy.getValueHistory(0);
        
        assertEq(history.value, INITIAL_VALUE);
        assertEq(history.cdiRate, INITIAL_CDI_RATE);
        assertEq(history.internalFee, INITIAL_INTERNAL_FEE);
        assertEq(history.apy, INITIAL_APY);
        assertEq(history.totalSupply, 0);
        assertEq(history.updatedBy, admin);
    }
    
    function testGetValueHistoryFailsForInvalidIndex() public {
        vm.expectRevert("BRcapy: History index out of bounds");
        brcapy.getValueHistory(999);
    }
    
    function testGetRecentHistory() public {
        // Adicionar mais entradas no histórico
        vm.warp(block.timestamp + 2 hours);
        vm.prank(backendUpdater);
        brcapy.updateValue(1.06 * 10**18, 1200, 115);
        
        vm.warp(block.timestamp + 2 hours);
        vm.prank(backendUpdater);
        brcapy.updateValue(1.07 * 10**18, 1250, 120);
        
        // Obter histórico recente
        BRcapy.ValueHistory[] memory recent = brcapy.getRecentHistory(2);
        
        assertEq(recent.length, 2);
        assertEq(recent[0].value, 1.06 * 10**18);
        assertEq(recent[1].value, 1.07 * 10**18);
    }
    
    function testGetRecentHistoryWithLargeCount() public view {
        BRcapy.ValueHistory[] memory recent = brcapy.getRecentHistory(10);
        
        // Deve retornar apenas o que existe (1 entrada)
        assertEq(recent.length, 1);
        assertEq(recent[0].value, INITIAL_VALUE);
    }
    
    function testGetRecentHistoryWithZeroCount() public view {
        BRcapy.ValueHistory[] memory recent = brcapy.getRecentHistory(0);
        assertEq(recent.length, 0);
    }

    // ==========================================
    // ADMIN FUNCTIONS TESTS
    // ==========================================
    
    function testUpdateBackendUpdater() public {
        address newUpdater = makeAddr("newUpdater");
        
        vm.startPrank(admin);
        
        brcapy.updateBackendUpdater(newUpdater);
        
        assertEq(brcapy.backendUpdater(), newUpdater);
        assertTrue(brcapy.hasRole(brcapy.VALUE_UPDATER_ROLE(), newUpdater));
        assertTrue(brcapy.hasRole(brcapy.MINTER_ROLE(), newUpdater));
        assertFalse(brcapy.hasRole(brcapy.VALUE_UPDATER_ROLE(), backendUpdater));
        assertFalse(brcapy.hasRole(brcapy.MINTER_ROLE(), backendUpdater));
        
        vm.stopPrank();
    }
    
    function testUpdateBackendUpdaterFailsForNonAdmin() public {
        address newUpdater = makeAddr("newUpdater");
        
        vm.startPrank(nonUpdater);
        
        vm.expectRevert();
        brcapy.updateBackendUpdater(newUpdater);
        
        vm.stopPrank();
    }

    // ==========================================
    // PAUSABLE TESTS
    // ==========================================
    
    function testPauseAndUnpause() public {
        vm.startPrank(admin);
        
        brcapy.pause();
        assertTrue(brcapy.paused());
        
        brcapy.unpause();
        assertFalse(brcapy.paused());
        
        vm.stopPrank();
    }
    
    function testMintFailsWhenPaused() public {
        vm.prank(admin);
        brcapy.pause();
        
        vm.startPrank(backendUpdater);
        
        vm.expectRevert("Pausable: paused");
        brcapy.mintFromBRL(user1, 1000 * 10**18);
        
        vm.stopPrank();
    }
    
    function testUpdateValueFailsWhenPaused() public {
        vm.prank(admin);
        brcapy.pause();
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.startPrank(backendUpdater);
        
        vm.expectRevert("Pausable: paused");
        brcapy.updateValue(1.06 * 10**18, 1200, 115);
        
        vm.stopPrank();
    }

    // ==========================================
    // FUZZ TESTS
    // ==========================================
    
    function testFuzzMintFromBRL(uint256 brlAmount) public {
        // Limitar valores para evitar overflow
        vm.assume(brlAmount > 0 && brlAmount <= 1000000 * 10**18);
        
        uint256 expectedTokens = (brlAmount * PRECISION) / INITIAL_VALUE;
        vm.assume(expectedTokens <= MAX_SUPPLY);
        
        vm.prank(backendUpdater);
        brcapy.mintFromBRL(user1, brlAmount);
        
        assertEq(brcapy.balanceOf(user1), expectedTokens);
        assertEq(brcapy.totalValueBRL(), brlAmount);
    }
    
    function testFuzzValueUpdate(uint256 newValue, uint256 newCDI, uint256 newFee) public {
        // Limitar valores para serem válidos
        vm.assume(newValue > 0 && newValue <= 10 * 10**18); // Máximo 10 BRL
        vm.assume(newCDI >= newFee && newCDI <= 5000); // Máximo 50%
        vm.assume(newFee <= 1000); // Máximo 10%
        
        // Verificar se mudança está dentro do limite (20%)
        if (INITIAL_VALUE > 0) {
            uint256 change = newValue > INITIAL_VALUE 
                ? ((newValue - INITIAL_VALUE) * BASIS_POINTS) / INITIAL_VALUE
                : ((INITIAL_VALUE - newValue) * BASIS_POINTS) / INITIAL_VALUE;
            
            vm.assume(change <= 2000); // 20%
        }
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(backendUpdater);
        brcapy.updateValue(newValue, newCDI, newFee);
        
        assertEq(brcapy.currentValue(), newValue);
        assertEq(brcapy.cdiRate(), newCDI);
        assertEq(brcapy.internalFeeRate(), newFee);
        assertEq(brcapy.currentAPY(), newCDI - newFee);
    }

    // ==========================================
    // INTEGRATION TESTS
    // ==========================================
    
    function testCompleteYieldcoinJourney() public {
        // 1. Mintar tokens para user1 (1000 BRL)
        uint256 brlAmount = 1000 * 10**18;
        vm.prank(backendUpdater);
        brcapy.mintFromBRL(user1, brlAmount);
        
        uint256 initialTokens = brcapy.balanceOf(user1);
        
        // 2. Avançar tempo e atualizar valor (simular yield diário)
        vm.warp(block.timestamp + 1 days);
        
        vm.prank(backendUpdater);
        brcapy.updateValue(
            INITIAL_VALUE + (INITIAL_VALUE * INITIAL_APY / BASIS_POINTS / 365), // Valor aumenta baseado no APY
            INITIAL_CDI_RATE,
            INITIAL_INTERNAL_FEE
        );
        
        // 3. Verificar que o valor dos tokens aumentou
        uint256 newTokenValue = brcapy.tokensToBRL(initialTokens);
        assertGt(newTokenValue, brlAmount); // Valor deve ter aumentado
        
        // 4. User1 transfere metade para user2
        vm.prank(user1);
        brcapy.transfer(user2, initialTokens / 2);
        
        // 5. User2 queima seus tokens
        vm.prank(user2);
        uint256 burnValue = brcapy.burnToBRL(brcapy.balanceOf(user2));
        
        assertGt(burnValue, brlAmount / 2); // Deve receber mais que investiu devido ao yield
        
        // 6. Verificar estado final
        assertEq(brcapy.balanceOf(user1), initialTokens / 2);
        assertEq(brcapy.balanceOf(user2), 0);
        assertEq(brcapy.totalSupply(), initialTokens / 2);
    }
    
    function testMultipleValueUpdatesAndHistory() public {
        uint256[] memory values = new uint256[](3);
        values[0] = 1.06 * 10**18;
        values[1] = 1.07 * 10**18;
        values[2] = 1.065 * 10**18;
        
        // Fazer múltiplas atualizações
        for (uint256 i = 0; i < values.length; i++) {
            vm.warp(block.timestamp + 2 hours);
            
            vm.prank(backendUpdater);
            brcapy.updateValue(values[i], INITIAL_CDI_RATE + uint256(i * 10), INITIAL_INTERNAL_FEE);
        }
        
        // Verificar histórico
        assertEq(brcapy.historyCount(), 4); // Initial + 3 updates
        
        BRcapy.ValueHistory[] memory recent = brcapy.getRecentHistory(4);
        assertEq(recent.length, 4);
        assertEq(recent[3].value, values[2]); // Último valor
    }
} 