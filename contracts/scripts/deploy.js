/**
 * DC1 Escrow deployment script
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network base-sepolia
 *
 * Required env vars (see .env.example):
 *   PRIVATE_KEY      — deployer wallet private key
 *   USDC_ADDRESS     — USDC token on target network
 *   ORACLE_ADDRESS   — DC1 backend signing address
 *
 * After deploy the ABI + address are written to abis/Escrow.json
 * so the Express.js backend can consume them directly.
 */

const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Base Sepolia USDC (official Circle deployment)
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("─────────────────────────────────────────");
  console.log("DC1 Escrow Deployment");
  console.log("─────────────────────────────────────────");
  console.log("Network   :", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer  :", deployer.address);
  console.log(
    "Balance   :",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // ── Config ────────────────────────────────────────────────────────────────
  const usdcAddress = process.env.USDC_ADDRESS || BASE_SEPOLIA_USDC;
  const oracleAddress = process.env.ORACLE_ADDRESS || deployer.address;

  console.log("\nUSVC address :", usdcAddress);
  console.log("Oracle address:", oracleAddress);

  if (!process.env.ORACLE_ADDRESS) {
    console.warn(
      "\n⚠  ORACLE_ADDRESS not set — using deployer as oracle (dev only!)"
    );
  }

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log("\nDeploying Escrow.sol...");
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(usdcAddress, oracleAddress);
  await escrow.waitForDeployment();

  const contractAddress = await escrow.getAddress();
  console.log("\n✓ Escrow deployed to:", contractAddress);

  // ── Export ABI ────────────────────────────────────────────────────────────
  const artifact = await artifacts.readArtifact("Escrow");
  const abiDir = path.join(__dirname, "../abis");

  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const output = {
    address: contractAddress,
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  const abiPath = path.join(abiDir, "Escrow.json");
  fs.writeFileSync(abiPath, JSON.stringify(output, null, 2));
  console.log("✓ ABI + address exported to contracts/abis/Escrow.json");

  // ── Verification hint ─────────────────────────────────────────────────────
  console.log("\nTo verify on Basescan:");
  console.log(
    `  npx hardhat verify --network base-sepolia ${contractAddress} "${usdcAddress}" "${oracleAddress}"`
  );

  console.log("─────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
