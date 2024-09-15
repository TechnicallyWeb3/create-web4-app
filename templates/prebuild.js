require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const FormData = require('form-data');

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataGateway = process.env.PINATA_GATEWAY;
const contractAddress = process.env.CONTRACT_ADDRESS;

async function uploadToPinata(filePath) {
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
  
  let data = new FormData();
  data.append('file', fs.createReadStream(filePath));

  console.log(`Uploading ${filePath} to Pinata...`);
  const response = await axios.post(url, data, {
    maxBodyLength: 'Infinity',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecretApiKey
    }
  });

  console.log(`Successfully uploaded ${filePath} to Pinata. IPFS hash: ${response.data.IpfsHash}`);
  return response.data.IpfsHash;
}

function replaceInFile(filePath, replacements) {
  console.log(`Updating asset URLs in ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  let replacementMade = false;

  for (const [oldUrl, newUrl] of Object.entries(replacements)) {
    const fileName = path.basename(oldUrl);
    const regexPatterns = [
      // For import statements
      { regex: new RegExp(`import\\s+(\\w+)\\s+from\\s+(['"]).*${fileName}(['"])`, 'g'),
        replacement: `const $1 = "${newUrl}"` },
      // For img src attributes
      { regex: new RegExp(`src=(['"]).*${fileName}(['"])`, 'g'),
        replacement: `src="${newUrl}"` },
      // For a href attributes
      { regex: new RegExp(`href=(['"]).*${fileName}(['"])`, 'g'),
        replacement: `href="${newUrl}"` },
      // For video src attributes
      { regex: new RegExp(`<video[^>]*src=(['"]).*${fileName}(['"])[^>]*>`, 'g'),
        replacement: (match) => match.replace(`src=(['"]).*${fileName}(['"])`, `src="${newUrl}"`) },
      // For audio src attributes
      { regex: new RegExp(`<audio[^>]*src=(['"]).*${fileName}(['"])[^>]*>`, 'g'),
        replacement: (match) => match.replace(`src=(['"]).*${fileName}(['"])`, `src="${newUrl}"`) },
      // For source src attributes (used within video and audio tags)
      { regex: new RegExp(`<source[^>]*src=(['"]).*${fileName}(['"])[^>]*>`, 'g'),
        replacement: (match) => match.replace(`src=(['"]).*${fileName}(['"])`, `src="${newUrl}"`) },
      // For track src attributes (used for subtitles, captions, etc.)
      { regex: new RegExp(`<track[^>]*src=(['"]).*${fileName}(['"])[^>]*>`, 'g'),
        replacement: (match) => match.replace(`src=(['"]).*${fileName}(['"])`, `src="${newUrl}"`) },
      // For embed src attributes
      { regex: new RegExp(`<embed[^>]*src=(['"]).*${fileName}(['"])[^>]*>`, 'g'),
        replacement: (match) => match.replace(`src=(['"]).*${fileName}(['"])`, `src="${newUrl}"`) },
      // For object data attributes
      { regex: new RegExp(`<object[^>]*data=(['"]).*${fileName}(['"])[^>]*>`, 'g'),
        replacement: (match) => match.replace(`data=(['"]).*${fileName}(['"])`, `data="${newUrl}"`) },
      // For CSS url() functions
      { regex: new RegExp(`url\\((['"]?).*${fileName}(['"]?)\\)`, 'g'),
        replacement: `url("${newUrl}")` },
      // For inline styles
      { regex: new RegExp(`style=(['"])[^'"]*${fileName}[^'"]*(['"])`, 'g'),
        replacement: (match) => match.replace(fileName, newUrl) },
      // For other occurrences (like inline styles or custom attributes)
      { regex: new RegExp(`(['"]).*${fileName}(['"])`, 'g'),
        replacement: `"${newUrl}"` }
    ];

    for (const { regex, replacement } of regexPatterns) {
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        replacementMade = true;
      }
    }
  }

  if (replacementMade) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated asset URLs in ${filePath}`);
  } else {
    console.log(`No replacements made in ${filePath}`);
  }
}

async function replaceAssetUrls() {
  console.log('Starting to replace asset URLs in src directory...');
  const assetFiles = glob.sync('src/**/*.{png,jpg,jpeg,gif,svg}');
  const replacements = {};

  for (const file of assetFiles) {
    const hash = await uploadToPinata(file);
    const pinataUrl = `${pinataGateway}/ipfs/${hash}`;
    replacements[path.basename(file)] = pinataUrl;
  }

  const jsFiles = glob.sync('src/**/*.{js,jsx,ts,tsx}');
  for (const file of jsFiles) {
    console.log(`Updating asset URLs in ${file}...`);
    let content = fs.readFileSync(file, 'utf8');
    for (const [oldUrl, newUrl] of Object.entries(replacements)) {
      // Replace import statements
      const importRegex = new RegExp(`import\\s+(\\w+)\\s+from\\s+(['"]).*${oldUrl}(['"])`, 'g');
      content = content.replace(importRegex, `const $1 = "${newUrl}"`);

      // Replace src attributes in img tags, keeping src
      const srcRegex = new RegExp(`src={([^}]*${oldUrl}[^}]*)}`, 'g');
      content = content.replace(srcRegex, `src="${newUrl}"`);

      // Replace other occurrences
      content = content.replace(new RegExp(oldUrl, 'g'), newUrl);
    }
    fs.writeFileSync(file, content);
    console.log(`Updated asset URLs in ${file}`);
  }
  console.log('Finished replacing asset URLs in src directory.');
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

async function main() {
  console.log('Starting pre-build process...');
  
  // Handle src folder
  await replaceAssetUrls();
  
  // Handle public folder
  const publicAssetReplacements = await handlePublicAssets();
  await modifyIndexHtml(publicAssetReplacements);
  
  console.log('Pre-build tasks completed successfully.');
  
  console.log('Running React build...');
  require('child_process').execSync('react-scripts build', { stdio: 'inherit' });
  console.log('React build completed.');
}

main().catch((error) => {
  console.error('An error occurred during the pre-build process:', error);
  process.exit(1);
});