require('dotenv').config();
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const axios = require('axios');
const FormData = require('form-data');
const deployReport = require('./deployReport');
const { checkAndCorrectOrder } = require('./codeFormatter');

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataGateway = process.env.PINATA_GATEWAY;
const contractAddress = process.argv[2] || process.env.CONTRACT_ADDRESS;

async function uploadToPinata(filePath) {
  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  const data = new FormData();
  data.append('file', fs.createReadStream(filePath));

  try {
    const response = await axios.post(url, data, {
      maxBodyLength: 'Infinity',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretApiKey
      }
    });
    console.log(`File ${filePath} uploaded to Pinata. IPFS hash: ${response.data.IpfsHash}`);
    const fileSize = fs.statSync(filePath).size;
    deployReport.addPinataFileSize(fileSize);
    return response.data.IpfsHash;
  } catch (error) {
    console.error(`Error uploading ${filePath} to Pinata:`, error);
    throw error;
  }
}

async function processMatch(variableName, importPath, filePath) {
  // Ignore CSS files
  if (importPath.endsWith('.css') || importPath.endsWith('.scss') || importPath.endsWith('.sass')) {
    return null;
  }

  if (!importPath.startsWith('http') && !importPath.startsWith('data:')) {
    let absolutePath = path.resolve(path.dirname(filePath), importPath);
    
    // Check if the file exists, if not, try prepending 'src/'
    if (!fs.existsSync(absolutePath)) {
      absolutePath = path.resolve('src', importPath);
    }

    // Check common asset directories
    const assetDirs = ['assets', 'images', 'media'];
    for (const dir of assetDirs) {
      if (!fs.existsSync(absolutePath)) {
        absolutePath = path.resolve('src', dir, importPath);
        if (fs.existsSync(absolutePath)) break;
      }
    }

    if (fs.existsSync(absolutePath)) {
      const ipfsHash = await uploadToPinata(absolutePath);
      const ipfsUrl = `${pinataGateway}/ipfs/${ipfsHash}`;
      return `const ${variableName} = "${ipfsUrl}";`;
    }
  }
  return null;
}

async function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /import\s+(\w+)\s+from\s+['"](.+)['"];?/g;
  const constRegex = /const\s+(\w+)\s*=\s*(['"])(.+)\2;?/g;
  
  let match;
  const replacements = [];

  // Process import statements
  while ((match = importRegex.exec(content)) !== null) {
    const [fullMatch, variableName, importPath] = match;
    const newStatement = await processMatch(variableName, importPath, filePath);
    if (newStatement) {
      replacements.push([fullMatch, newStatement]);
    }
  }

  // Process const assignments
  while ((match = constRegex.exec(content)) !== null) {
    const [fullMatch, variableName, _, constPath] = match;
    const newStatement = await processMatch(variableName, constPath, filePath);
    if (newStatement) {
      replacements.push([fullMatch, newStatement]);
    }
  }

  // Apply replacements
  for (const [oldValue, newValue] of replacements.reverse()) {
    content = content.replace(oldValue, newValue);
  }

  if (replacements.length > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated file: ${filePath}`);
    return true; // Indicate that the file was modified
  }
  return false; // Indicate that the file was not modified
}

async function processDirectory(directory) {
  const files = glob.sync(`${directory}/**/*.{js,jsx,ts,tsx}`);
  for (const file of files) {
    const wasModified = await processFile(file);
    if (wasModified) {
      // Only run the code formatter if the file was modified
      checkAndCorrectOrder(file);
    }
  }
}

async function main() {
  try {
    await processDirectory('./src');
    console.log('Prebuild process completed successfully.');
  } catch (error) {
    console.error('An error occurred during the prebuild process:', error);
    process.exit(1);
  }
}

main();