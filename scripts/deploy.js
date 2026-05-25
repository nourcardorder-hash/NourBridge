const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  console.log("🚀 Starting TokenVault deployment...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  const deployerBalance = await deployer.getBalance();
  console.log("💰 Account balance:", ethers.formatEther(deployerBalance), "ETH\n");

  // Configuration
  const USDC_ADDRESS = process.env.MUMBAI_USDC_ADDRESS || "0x0FA8781a83E46826621b3BC9a0E0868F432c10f7";
  const INITIAL_SIGNERS = [
    deployer.address,
    // Add your other signer addresses here
    "0x1234567890123456789012345678901234567890",
  ];
  const REQUIRED_SIGNATURES = 2;

  console.log("⚙️  Configuration:");
  console.log("   USDC Address:", USDC_ADDRESS);
  console.log("   Initial Signers:", INITIAL_SIGNERS.length);
  console.log("   Required Signatures:", REQUIRED_SIGNATURES);
  console.log("   Initial Signers:", INITIAL_SIGNERS);

  // Deploy TokenVaultMultiSig
  console.log("\n📦 Deploying TokenVaultMultiSig...");
  const TokenVaultMultiSig = await ethers.getContractFactory("TokenVaultMultiSig");
  const vault = await TokenVaultMultiSig.deploy(INITIAL_SIGNERS, USDC_ADDRESS, REQUIRED_SIGNATURES);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ TokenVaultMultiSig deployed to:", vaultAddress);

  // Deploy MetaTransactionRelayer
  console.log("\n📦 Deploying MetaTransactionRelayer...");
  const MetaTransactionRelayer = await ethers.getContractFactory("MetaTransactionRelayer");
  const relayer = await MetaTransactionRelayer.deploy(
    vaultAddress,
    deployer.address,
    "NourBridge",
    "1"
  );
  await relayer.waitForDeployment();
  const relayerAddress = await relayer.getAddress();
  console.log("✅ MetaTransactionRelayer deployed to:", relayerAddress);

  // Verify vault
  console.log("\n🔐 Vault Information:");
  const signerCount = await vault.getSignerCount();
  console.log("   Signers:", signerCount.toString());
  const usdcBalance = await vault.getUSDCBalance();
  console.log("   USDC Balance:", ethers.formatUnits(usdcBalance, 6), "USDC");
  const maticBalance = await vault.getMATICBalance();
  console.log("   MATIC Balance:", ethers.formatEther(maticBalance), "MATIC");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      TokenVaultMultiSig: vaultAddress,
      MetaTransactionRelayer: relayerAddress,
      USDC: USDC_ADDRESS,
    },
    configuration: {
      initialSigners: INITIAL_SIGNERS,
      requiredSignatures: REQUIRED_SIGNATURES,
    },
  };

  const fs = require("fs");
  fs.writeFileSync(
    `deployments/${hre.network.name}-deployment.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📄 Deployment info saved to:", `deployments/${hre.network.name}-deployment.json`);

  console.log("\n✨ Deployment completed successfully!");
  console.log("\n📋 Next steps:");
  console.log("   1. Verify contracts on PolygonScan");
  console.log("   2. Update .env with contract addresses");
  console.log("   3. Run security tests");
  console.log("   4. Setup whitelist (if needed)");
  console.log("   5. Configure relayer");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
