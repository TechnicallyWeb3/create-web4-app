const { execSync } = require('child_process');
const deployReport = require('./deployReport');
const ethers = require('ethers');
const fs = require('fs');
require('dotenv').config();

async function runDeploy() {
  try {
    console.log('Starting deployment process...');
    
    const provider = new ethers.JsonRpcProvider(process.env.INFURA_API);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Check initial balance
    const initialBalance = await provider.getBalance(wallet.address);
    console.log('Initial balance:', ethers.formatEther(initialBalance), 'ETH');

    // Run deploy-contract and capture the new contract address
    console.log('Deploying contract...');
    const deployOutput = execSync('node deployContract.js', { encoding: 'utf8' });
    const outputLines = deployOutput.trim().split('\n');
    const newContractAddress = outputLines[outputLines.length - 1].trim();
    console.log('New contract address:', newContractAddress);

    if (!ethers.isAddress(newContractAddress)) {
      throw new Error(`Invalid contract address: ${newContractAddress}`);
    }

    // Update process.env with the new contract address
    process.env.CONTRACT_ADDRESS = newContractAddress;

    // Run prebuild
    console.log('Running prebuild...');
    execSync(`node prebuild.js "${newContractAddress}"`, { stdio: 'inherit' });
    
    // Run build
    console.log('Building the project...');
    execSync('react-scripts build', { stdio: 'inherit' });
    
    // Run postbuild
    console.log('Running postbuild...');
    execSync(`node hostV3.js "${newContractAddress}"`, { stdio: 'inherit' });
    
    // Check final balance
    const finalBalance = await provider.getBalance(wallet.address);
    console.log('Final balance:', ethers.formatEther(finalBalance), 'ETH');

    // Calculate total cost
    const totalCost = initialBalance - finalBalance;
    console.log('Total deployment cost:', ethers.formatEther(totalCost), 'ETH');

    // Update deployment report
    deployReport.setDeploymentCost(ethers.formatEther(totalCost));

    // Add contract address
    deployReport.setContractAddress(newContractAddress);
    
    // Generate and save the report
    await deployReport.generateReport();
    
    console.log('Deployment process completed successfully.');
  } catch (error) {
    console.error('An error occurred during the deployment process:', error);
    process.exit(1);
  }
}

runDeploy().catch(console.error);