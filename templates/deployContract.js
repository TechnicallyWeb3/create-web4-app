require('dotenv').config();
const fs = require('fs');
const ethers = require('ethers');
const solc = require('solc');

const provider = new ethers.JsonRpcProvider(process.env.INFURA_API);
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  console.error('Private key is missing. Please check your .env file.');
  process.exit(1);
}

const wallet = new ethers.Wallet(privateKey, provider);

// Read the Solidity source code
const contractSource = fs.readFileSync('./WebsiteContractV3.sol', 'utf8');

// Compile the contract
function compileContract(source) {
  const input = {
    language: 'Solidity',
    sources: {
      'WebsiteContractV3.sol': {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const contract = output.contracts['WebsiteContractV3.sol']['WebsiteContract'];
  
  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object,
  };
}

async function deployContract() {
  console.log('Compiling contract...');
  const { abi, bytecode } = compileContract(contractSource);

  console.log('Deploying contract...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  try {
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();
    console.log('Contract deployed at:', deployedAddress);
    
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
  } catch (error) {
    console.error('Error deploying contract:', error);
    process.exit(1);
  }
}

deployContract().then((address) => {
  console.log(address); // Ensure the address is the last thing printed
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});