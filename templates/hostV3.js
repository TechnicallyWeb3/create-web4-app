require('dotenv').config();
const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

const contractAddress = process.argv[2] || process.env.CONTRACT_ADDRESS;

const CHUNK_SIZE = 14576;

async function addWebsiteInChunks(contract, path, content, contentType) {
    try {
        const totalChunks = Math.ceil(content.length / CHUNK_SIZE);
        console.log(`Total chunks to upload for ${contentType}: ${totalChunks}`);

        // Get the total chunks already uploaded to compare
        const existingTotalChunks = await contract.getTotalChunks(path);

        for (let i = 0; i < totalChunks; i++) {
            const chunk = content.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

            // Check if chunk already exists before uploading
            if (i < existingTotalChunks) {
                const existingChunk = await contract.getResourceChunk(path, i);
                if (existingChunk[0] === chunk && existingChunk[1] === contentType) {
                    console.log(`Chunk ${i + 1}/${totalChunks} is identical, skipping upload.`);
                    continue; // Skip if the chunk is already the same
                }
            }

            // If chunk is new or modified, upload it
            const tx = await contract.setResourceChunk(path, chunk, contentType);
            const receipt = await tx.wait();

            // Log progress after each chunk is sent
            console.log(`Chunk ${i + 1}/${totalChunks} of ${contentType} uploaded successfully. Transaction hash: ${receipt.transactionHash}`);
        }

        console.log(`${contentType} added successfully in chunks`);
    } catch (error) {
        console.error(`Error adding ${contentType}:`, error);
    }
}

async function uploadWebsite() {
    // Get the contract factory and ABI
    const WebsiteContract = await hre.ethers.getContractFactory("WebsiteContract");
    
    // Get the signer
    const [signer] = await hre.ethers.getSigners();

    // Create contract instance
    const contract = WebsiteContract.attach(contractAddress).connect(signer);

    console.log(contractAddress);
    
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
    await addWebsiteInChunks(contract, "/", htmlContent, "text/html");
    
    if (cssContent) {
        await addWebsiteInChunks(contract, "/styles.css", cssContent, "text/css");
    }
    
    if (jsContent) {
        await addWebsiteInChunks(contract, "/script.js", jsContent, "application/javascript");
    }
}

async function main() {
    await uploadWebsite();
    console.log('Website uploaded successfully.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('An error occurred during website upload:', error);
        process.exit(1);
    });