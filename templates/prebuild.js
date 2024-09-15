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
    return response.data.IpfsHash;
  } catch (error) {
    console.error(`Error uploading ${filePath} to Pinata:`, error);
    throw error;
  }
}

async function handlePublicAssets() {
  console.log('Starting to handle public assets...');
  const publicAssets = glob.sync('public/*.{ico,png,json}');
  const replacements = {};

  for (const file of publicAssets) {
    const hash = await uploadToPinata(file);
    const pinataUrl = `${pinataGateway}/ipfs/${hash}`;
    replacements[path.basename(file)] = pinataUrl;
  }

  console.log('Finished handling public assets.');
  return replacements;
}

async function modifyIndexHtml(assetReplacements) {
  console.log('Starting to modify index.html...');
  const indexPath = 'public/index.html';
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Replace script and style links
  content = content.replace(
    /<script src="(.*?)"><\/script>/g,
    `<script src="web://${contractAddress}/script.js"></script>`
  );
  
  content = content.replace(
    /<link rel="stylesheet" href="(.*?)">/g,
    `<link rel="stylesheet" href="web://${contractAddress}/styles.css">`
  );

  // Replace public asset URLs
  for (const [oldUrl, newUrl] of Object.entries(assetReplacements)) {
    content = content.replace(new RegExp(`%PUBLIC_URL%/${oldUrl}`, 'g'), newUrl);
  }

  fs.writeFileSync(indexPath, content);
  console.log('Finished modifying index.html');
}

async function formatSourceFiles() {
  const sourceFiles = glob.sync('src/**/*.{js,jsx,ts,tsx}');
  const publicFiles = glob.sync('public/*.{js,html}');
  
  [...sourceFiles, ...publicFiles].forEach(file => {
    checkAndCorrectOrder(file);
  });
}

async function main() {
  try {
    const assetReplacements = await handlePublicAssets();
    await modifyIndexHtml(assetReplacements);
    await formatSourceFiles(); // Move this after modifyIndexHtml
    console.log('Prebuild process completed successfully.');
  } catch (error) {
    console.error('Error in prebuild process:', error);
    process.exit(1);
  }
}

main();