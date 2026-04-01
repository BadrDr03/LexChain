const hre = require("hardhat");

async function main() {
  const LexChain = await hre.ethers.getContractFactory("LexChain");
  const lexchain = await LexChain.deploy();

  await lexchain.deployed();

  console.log("-----------------------------------------------");
  console.log("LexChain deployed to:", lexchain.address);
  console.log("-----------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});