const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenVaultMultiSig", function () {
  let vault, usdc, deployer, signer1, signer2, signer3, user1, user2;
  const USDC_DECIMALS = 6;
  const DEPOSIT_AMOUNT = ethers.parseUnits("1000", USDC_DECIMALS); // 1000 USDC
  const WITHDRAW_AMOUNT = ethers.parseUnits("500", USDC_DECIMALS); // 500 USDC

  beforeEach(async function () {
    [deployer, signer1, signer2, signer3, user1, user2] = await ethers.getSigners();

    // Deploy mock USDC token
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    usdc = await ERC20Mock.deploy("USDC Token", "USDC", USDC_DECIMALS);

    // Give users some USDC
    await usdc.mint(user1.address, ethers.parseUnits("5000", USDC_DECIMALS));
    await usdc.mint(user2.address, ethers.parseUnits("5000", USDC_DECIMALS));
    await usdc.mint(deployer.address, ethers.parseUnits("5000", USDC_DECIMALS));

    // Deploy vault
    const TokenVaultMultiSig = await ethers.getContractFactory("TokenVaultMultiSig");
    const initialSigners = [deployer.address, signer1.address, signer2.address];
    vault = await TokenVaultMultiSig.deploy(initialSigners, await usdc.getAddress(), 2);

    // Whitelist users
    await vault.whitelistReceiver(user1.address);
    await vault.whitelistReceiver(user2.address);
  });

  describe("Initialization", function () {
    it("Should initialize with correct signers", async function () {
      const signerCount = await vault.getSignerCount();
      expect(signerCount).to.equal(3);
    });

    it("Should initialize with correct required signatures", async function () {
      const required = await vault.requiredSignatures();
      expect(required).to.equal(2);
    });

    it("Should verify signers are in the list", async function () {
      const isDeployerSigner = await vault.isSignerMap(deployer.address);
      const isSigner1 = await vault.isSignerMap(signer1.address);
      expect(isDeployerSigner).to.be.true;
      expect(isSigner1).to.be.true;
    });
  });

  describe("Deposits", function () {
    it("Should allow USDC deposit from whitelisted user", async function () {
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      
      await expect(vault.connect(user1).depositUSDC(DEPOSIT_AMOUNT))
        .to.emit(vault, "TokenDeposited")
        .withArgs(user1.address, DEPOSIT_AMOUNT, await usdc.getAddress());

      const vaultBalance = await vault.getUSDCBalance();
      expect(vaultBalance).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should reject deposit from non-whitelisted user when whitelist enabled", async function () {
      const notWhitelisted = signer3;
      await usdc.mint(notWhitelisted.address, DEPOSIT_AMOUNT);
      await usdc.connect(notWhitelisted).approve(await vault.getAddress(), DEPOSIT_AMOUNT);

      await expect(
        vault.connect(notWhitelisted).depositUSDC(DEPOSIT_AMOUNT)
      ).to.be.revertedWith("Sender not whitelisted");
    });

    it("Should allow deposit when whitelist disabled", async function () {
      await vault.toggleWhitelist();
      const notWhitelisted = signer3;
      await usdc.mint(notWhitelisted.address, DEPOSIT_AMOUNT);
      await usdc.connect(notWhitelisted).approve(await vault.getAddress(), DEPOSIT_AMOUNT);

      await expect(vault.connect(notWhitelisted).depositUSDC(DEPOSIT_AMOUNT))
        .to.emit(vault, "TokenDeposited");
    });

    it("Should allow MATIC deposit", async function () {
      const maticAmount = ethers.parseEther("1.0");

      await expect(vault.connect(user1).depositMATIC({ value: maticAmount }))
        .to.emit(vault, "TokenDeposited")
        .withArgs(user1.address, maticAmount, ethers.ZeroAddress);

      const vaultBalance = await vault.getMATICBalance();
      expect(vaultBalance).to.equal(maticAmount);
    });

    it("Should reject zero amount deposit", async function () {
      await expect(vault.connect(user1).depositUSDC(0))
        .to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Withdrawal Requests", function () {
    beforeEach(async function () {
      // Setup: Make deposits
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).depositUSDC(DEPOSIT_AMOUNT);
    });

    it("Should create withdrawal request", async function () {
      await expect(
        vault.connect(deployer).requestWithdrawal(user2.address, WITHDRAW_AMOUNT, await usdc.getAddress())
      )
        .to.emit(vault, "WithdrawalRequested")
        .withArgs(0, user2.address, WITHDRAW_AMOUNT, await usdc.getAddress());
    });

    it("Should reject withdrawal request from non-signer", async function () {
      await expect(
        vault.connect(user1).requestWithdrawal(user2.address, WITHDRAW_AMOUNT, await usdc.getAddress())
      ).to.be.revertedWith("Only signers can call this");
    });

    it("Should reject invalid token", async function () {
      await expect(
        vault.connect(deployer).requestWithdrawal(user2.address, WITHDRAW_AMOUNT, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid token");
    });

    it("Should reject zero amount", async function () {
      await expect(
        vault.connect(deployer).requestWithdrawal(user2.address, 0, await usdc.getAddress())
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Withdrawal Approvals", function () {
    beforeEach(async function () {
      // Setup: Make deposits and create withdrawal request
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).depositUSDC(DEPOSIT_AMOUNT);
      await vault.connect(deployer).requestWithdrawal(user2.address, WITHDRAW_AMOUNT, await usdc.getAddress());
    });

    it("Should approve withdrawal request", async function () {
      await expect(vault.connect(deployer).approveWithdrawal(0))
        .to.emit(vault, "WithdrawalApproved")
        .withArgs(0, deployer.address);
    });

    it("Should reject approval from non-signer", async function () {
      await expect(vault.connect(user1).approveWithdrawal(0))
        .to.be.revertedWith("Only signers can call this");
    });

    it("Should reject duplicate approval from same signer", async function () {
      await vault.connect(deployer).approveWithdrawal(0);
      await expect(vault.connect(deployer).approveWithdrawal(0))
        .to.be.revertedWith("Already approved by this signer");
    });

    it("Should allow multiple signers to approve", async function () {
      await vault.connect(deployer).approveWithdrawal(0);
      await vault.connect(signer1).approveWithdrawal(0);

      const request = await vault.getWithdrawalRequest(0);
      expect(request.approvals).to.equal(2);
    });
  });

  describe("Withdrawal Execution", function () {
    beforeEach(async function () {
      // Setup: Make deposits and create withdrawal request
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).depositUSDC(DEPOSIT_AMOUNT);
      await vault.connect(deployer).requestWithdrawal(user2.address, WITHDRAW_AMOUNT, await usdc.getAddress());
    });

    it("Should execute withdrawal with sufficient approvals", async function () {
      await vault.connect(deployer).approveWithdrawal(0);
      await vault.connect(signer1).approveWithdrawal(0);

      const user2BalanceBefore = await usdc.balanceOf(user2.address);

      await expect(vault.connect(signer2).executeWithdrawal(0))
        .to.emit(vault, "WithdrawalExecuted")
        .withArgs(0, user2.address, WITHDRAW_AMOUNT, await usdc.getAddress());

      const user2BalanceAfter = await usdc.balanceOf(user2.address);
      expect(user2BalanceAfter - user2BalanceBefore).to.equal(WITHDRAW_AMOUNT);
    });

    it("Should reject execution with insufficient approvals", async function () {
      await vault.connect(deployer).approveWithdrawal(0);

      await expect(vault.connect(signer2).executeWithdrawal(0))
        .to.be.revertedWith("Insufficient approvals");
    });

    it("Should reject double execution", async function () {
      await vault.connect(deployer).approveWithdrawal(0);
      await vault.connect(signer1).approveWithdrawal(0);

      await vault.connect(signer2).executeWithdrawal(0);

      await expect(vault.connect(deployer).executeWithdrawal(0))
        .to.be.revertedWith("Already executed");
    });

    it("Should enforce rate limiting", async function () {
      // First withdrawal
      await vault.connect(deployer).approveWithdrawal(0);
      await vault.connect(signer1).approveWithdrawal(0);
      await vault.connect(signer2).executeWithdrawal(0);

      // Try second withdrawal within cooldown
      await vault.connect(deployer).requestWithdrawal(user2.address, WITHDRAW_AMOUNT, await usdc.getAddress());
      await vault.connect(deployer).approveWithdrawal(1);
      await vault.connect(signer1).approveWithdrawal(1);

      await expect(vault.connect(signer2).executeWithdrawal(1))
        .to.be.revertedWith("Withdrawal cooldown not met");
    });
  });

  describe("Signer Management", function () {
    it("Should add new signer", async function () {
      const newSigner = signer3;
      await expect(vault.addSigner(newSigner.address))
        .to.emit(vault, "SignerAdded")
        .withArgs(newSigner.address);

      const isNewSigner = await vault.isSignerMap(newSigner.address);
      expect(isNewSigner).to.be.true;
    });

    it("Should reject adding duplicate signer", async function () {
      await expect(vault.addSigner(deployer.address))
        .to.be.revertedWith("Already a signer");
    });

    it("Should remove signer", async function () {
      // First add signer to have more than minimum
      await vault.addSigner(signer3.address);

      await expect(vault.removeSigner(signer3.address))
        .to.emit(vault, "SignerRemoved")
        .withArgs(signer3.address);

      const isSigner = await vault.isSignerMap(signer3.address);
      expect(isSigner).to.be.false;
    });

    it("Should reject removal below minimum signers", async function () {
      // Currently have 3 signers, required is 2
      // Try to remove one - should fail because 2-1=1 < 2
      await expect(vault.removeSigner(signer2.address))
        .to.be.revertedWith("Cannot remove signer below required threshold");
    });

    it("Should update required signatures", async function () {
      await vault.addSigner(signer3.address);

      await expect(vault.setRequiredSignatures(3))
        .to.emit(vault, "RequiredSignaturesChanged")
        .withArgs(3);

      const required = await vault.requiredSignatures();
      expect(required).to.equal(3);
    });
  });

  describe("Emergency Functions", function () {
    it("Should pause contract", async function () {
      await vault.pause();

      await expect(vault.connect(user1).depositMATIC({ value: ethers.parseEther("1") }))
        .to.be.revertedWith("Pausable: paused");
    });

    it("Should unpause contract", async function () {
      await vault.pause();
      await vault.unpause();

      await expect(vault.connect(user1).depositMATIC({ value: ethers.parseEther("1") }))
        .to.emit(vault, "TokenDeposited");
    });

    it("Should only allow owner to pause", async function () {
      await expect(vault.connect(user1).pause())
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Balance Queries", function () {
    it("Should return correct USDC balance", async function () {
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).depositUSDC(DEPOSIT_AMOUNT);

      const balance = await vault.getUSDCBalance();
      expect(balance).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should return correct MATIC balance", async function () {
      const maticAmount = ethers.parseEther("2.5");
      await vault.connect(user1).depositMATIC({ value: maticAmount });

      const balance = await vault.getMATICBalance();
      expect(balance).to.equal(maticAmount);
    });
  });

  describe("Whitelist Management", function () {
    it("Should whitelist receiver", async function () {
      await expect(vault.whitelistReceiver(signer3.address))
        .to.emit(vault, "ReceiverWhitelisted")
        .withArgs(signer3.address);

      const isWhitelisted = await vault.whitelistedReceivers(signer3.address);
      expect(isWhitelisted).to.be.true;
    });

    it("Should remove from whitelist", async function () {
      await vault.whitelistReceiver(signer3.address);
      await expect(vault.removeFromWhitelist(signer3.address))
        .to.emit(vault, "ReceiverRemovedFromWhitelist");

      const isWhitelisted = await vault.whitelistedReceivers(signer3.address);
      expect(isWhitelisted).to.be.false;
    });

    it("Should toggle whitelist enforcement", async function () {
      const before = await vault.whitelistEnabled();
      await vault.toggleWhitelist();
      const after = await vault.whitelistEnabled();

      expect(after).to.equal(!before);
    });
  });
});

// Mock ERC20 for testing
describe("ERC20Mock", function () {
  it("Should deploy mock token", async function () {
    const [deployer] = await ethers.getSigners();
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const token = await ERC20Mock.deploy("Test Token", "TEST", 18);
    expect(await token.name()).to.equal("Test Token");
  });
});
