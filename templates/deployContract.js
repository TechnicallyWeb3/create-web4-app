const hre = require("hardhat");
const fs = require('fs');

async function deployContract() {
  console.log('Compiling contracts...');
  await hre.run('compile');
  console.log('Contracts compiled successfully');

  console.log('Deploying WebsiteContract...');
  const WebsiteContract = await hre.ethers.getContractFactory("WebsiteContract");
  const contract = await WebsiteContract.deploy();

  await contract.deployed();

  const deployedAddress = contract.address;
  console.log('WebsiteContract deployed to:', deployedAddress);

  // Update .env file with the new contract address
  const envContent = fs.readFileSync('.env', 'utf8');
  const updatedEnvContent = envContent.replace(
    /CONTRACT_ADDRESS=.*/,
    `CONTRACT_ADDRESS="${deployedAddress}"`
  );
  fs.writeFileSync('.env', updatedEnvContent);

  console.log('Updated .env file with new contract address');

  // Output only the new contract address as the last line
  console.log(deployedAddress);
  return deployedAddress;
}

deployContract().then((address) => {
  console.log(address); // Ensure the address is the last thing printed
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});