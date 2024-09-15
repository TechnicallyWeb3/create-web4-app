require('dotenv').config();
const {Web3} = require('web3');
const fs = require('fs'); 
const path = require('path'); 

const web3 = new Web3(`${process.env.INFURA_API}`);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "path",
				"type": "string"
			}
		],
		"name": "removeResource",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "path",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "content",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "contentType",
				"type": "string"
			}
		],
		"name": "setResourceChunk",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "path",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "index",
				"type": "uint256"
			}
		],
		"name": "getResourceChunk",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "path",
				"type": "string"
			}
		],
		"name": "getTotalChunks",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]
const contract = new web3.eth.Contract(contractABI, contractAddress);
const ownerAddress = '0x2DDE975DC63413dc35487E875d5681f3d9cf0dAE';
const privateKey = process.env.PRIVATE_KEY;  

const CHUNK_SIZE = 14576; 

async function addWebsiteInChunks(path, content, contentType) {
    try {
        const totalChunks = Math.ceil(content.length / CHUNK_SIZE);
        console.log(`Total chunks to upload for ${contentType}: ${totalChunks}`);

        // Get the total chunks already uploaded to compare
        const existingTotalChunks = await contract.methods.getTotalChunks(path).call();

        for (let i = 0; i < totalChunks; i++) {
            const chunk = content.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

            // Check if chunk already exists before uploading
            if (i < existingTotalChunks) {
                const existingChunk = await contract.methods.getResourceChunk(path, i).call();
                if (existingChunk[0] === chunk && existingChunk[1] === contentType) {
                    console.log(`Chunk ${i + 1}/${totalChunks} is identical, skipping upload.`);
                    continue; // Skip if the chunk is already the same
                }
            }

            // If chunk is new or modified, upload it
            const nonce = await web3.eth.getTransactionCount(ownerAddress, 'latest');
            const gasPrice = await web3.eth.getGasPrice();
            const gasEstimate = await contract.methods.setResourceChunk(path, chunk, contentType).estimateGas({ from: ownerAddress });

            const tx = {
                to: contractAddress,
                data: contract.methods.setResourceChunk(path, chunk, contentType).encodeABI(),
                gas: gasEstimate * BigInt(2),
                gasPrice: gasPrice * BigInt(2),
                nonce: nonce
            };

            const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

            // Log progress after each chunk is sent
            console.log(`Chunk ${i + 1}/${totalChunks} of ${contentType} uploaded successfully. Transaction hash: ${receipt.transactionHash}`);
        }

        console.log(`${contentType} added successfully in chunks`);
    } catch (error) {
        console.error(`Error adding ${contentType}:`, error);
    }
}

async function uploadWebsite() {
    // Read the index.html file
    const indexPath = path.join('build', 'index.html');
    let indexContent = fs.readFileSync(indexPath, 'utf8');

    // Find the CSS and JS file names before replacement
    const cssMatch = indexContent.match(/href="\/static\/css\/([^"]+)"/);
    const jsMatch = indexContent.match(/src="\/static\/js\/([^"]+)"/);

    let cssFileName = cssMatch ? cssMatch[1] : null;
    let jsFileName = jsMatch ? jsMatch[1] : null;

    // Function to replace a specific tag
    function replaceTag(content, regex, replacement) {
        const match = content.match(regex);
        if (match) {
            return content.replace(match[0], replacement);
        }
        return content;
    }

    // Replace the script tag (now accounting for defer attribute)
    indexContent = replaceTag(
        indexContent,
        /<script\s+defer="defer"\s+src="\/static\/js\/[^"]+"><\/script>/,
        `<script defer="defer" src="web://${contractAddress}/script.js"></script>`
    );

    // Replace the CSS link
    indexContent = replaceTag(
        indexContent,
        /<link\s+href="\/static\/css\/[^"]+"[^>]*>/,
        `<link href="web://${contractAddress}/styles.css" rel="stylesheet">`
    );

    // Write the modified HTML back to the file
    fs.writeFileSync(indexPath, indexContent);

    // Read the content of the files
    const htmlContent = indexContent;
    let cssContent = '';
    let jsContent = '';

    if (cssFileName) {
        try {
            cssContent = fs.readFileSync(path.join('build', 'static', 'css', cssFileName), 'utf8');
            console.log(`CSS file found: ${cssFileName}`);
        } catch (error) {
            console.warn(`Error reading CSS file: ${error.message}`);
        }
    } else {
        console.warn('No CSS file found in index.html');
    }

    if (jsFileName) {
        try {
            jsContent = fs.readFileSync(path.join('build', 'static', 'js', jsFileName), 'utf8');
            console.log(`JS file found: ${jsFileName}`);
        } catch (error) {
            console.warn(`Error reading JS file: ${error.message}`);
        }
    } else {
        console.warn('No JS file found in index.html');
    }

    // Upload the files
    await addWebsiteInChunks("/", htmlContent, "text/html");
    
    if (cssContent) {
        await addWebsiteInChunks("/styles.css", cssContent, "text/css");
    }
    
    if (jsContent) {
        await addWebsiteInChunks("/script.js", jsContent, "application/javascript");
    }
}

uploadWebsite().then(() => {
  console.log('Website uploaded successfully.');
  process.exit(0);
}).catch((error) => {
  console.error('An error occurred during website upload:', error);
  process.exit(1);
});