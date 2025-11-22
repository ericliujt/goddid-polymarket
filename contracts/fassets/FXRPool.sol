// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import { IAssetManager } from "@flarenetwork/flare-periphery-contracts/coston2/IAssetManager.sol";

/**
 * @title FXRPool
 * @dev A pool contract for managing FXRP tokens with deposit, withdraw, and transfer operations
 */
contract FXRPool is ReentrancyGuard, Ownable {
    IERC20 public immutable fxrpToken;
    uint256 public totalPoolBalance;
    
    // Track user deposits (optional - can be used for accounting)
    mapping(address => uint256) public userDeposits;
    
    // Events
    event Deposit(address indexed user, uint256 amount, uint256 newPoolBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newPoolBalance);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event BatchTransfer(address indexed from, address[] recipients, uint256[] amounts);

    /**
     * @dev Constructor - Gets FXRP token address from AssetManager
     */
    constructor() Ownable(msg.sender) {
        IAssetManager assetManager = ContractRegistry.getAssetManagerFXRP();
        fxrpToken = IERC20(address(assetManager.fAsset()));
    }

    /**
     * @dev Deposit FXRP into the pool
     * @param amount Amount of FXRP to deposit (in token units)
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        require(fxrpToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        totalPoolBalance += amount;
        userDeposits[msg.sender] += amount;
        
        emit Deposit(msg.sender, amount, totalPoolBalance);
    }

    /**
     * @dev Withdraw FXRP from the pool (user can withdraw their deposited amount)
     * @param amount Amount of FXRP to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        require(userDeposits[msg.sender] >= amount, "Insufficient balance");
        require(totalPoolBalance >= amount, "Pool has insufficient balance");
        
        userDeposits[msg.sender] -= amount;
        totalPoolBalance -= amount;
        
        require(fxrpToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit Withdraw(msg.sender, amount, totalPoolBalance);
    }

    /**
     * @dev Transfer FXRP from pool to a recipient address (owner only)
     * @param to Recipient address
     * @param amount Amount of FXRP to transfer
     */
    function transferTo(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Cannot transfer to zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(totalPoolBalance >= amount, "Pool has insufficient balance");
        
        totalPoolBalance -= amount;
        require(fxrpToken.transfer(to, amount), "Transfer failed");
        
        emit Transfer(address(this), to, amount);
    }

    /**
     * @dev Batch transfer FXRP to multiple recipients (owner only)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer (must match recipients length)
     */
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner nonReentrant {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(recipients[i] != address(0), "Cannot transfer to zero address");
            require(amounts[i] > 0, "Amount must be greater than zero");
            totalAmount += amounts[i];
        }
        
        require(totalPoolBalance >= totalAmount, "Pool has insufficient balance");
        
        totalPoolBalance -= totalAmount;
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(fxrpToken.transfer(recipients[i], amounts[i]), "Transfer failed");
        }
        
        emit BatchTransfer(address(this), recipients, amounts);
    }

    /**
     * @dev Get the current pool balance
     * @return Current total pool balance
     */
    function getPoolBalance() external view returns (uint256) {
        return totalPoolBalance;
    }

    /**
     * @dev Get user's deposit balance
     * @param user User address
     * @return User's deposited amount
     */
    function getUserBalance(address user) external view returns (uint256) {
        return userDeposits[user];
    }

    /**
     * @dev Get FXRP token address
     * @return FXRP token address
     */
    function getFXRPAddress() external view returns (address) {
        return address(fxrpToken);
    }

    /**
     * @dev Emergency function to recover tokens (owner only)
     * @param token Token address to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function emergencyRecover(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot recover to zero address");
        if (token == address(fxrpToken)) {
            // If recovering FXRP, update pool balance
            require(totalPoolBalance >= amount, "Cannot recover more than pool balance");
            totalPoolBalance -= amount;
        }
        IERC20(token).transfer(to, amount);
    }
}

