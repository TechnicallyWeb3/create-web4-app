const hre = require("hardhat");

async function main() {
  const WebsiteContract = await hre.ethers.getContractFactory("WebsiteContract");
  const websiteContract = await WebsiteContract.deploy();

  await websiteContract.deployed();

  console.log("WebsiteContract deployed to:", websiteContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });