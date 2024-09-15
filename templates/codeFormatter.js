const fs = require('fs');

function checkAndCorrectOrder(filePath) {
  console.log(`Checking and correcting import/const order in ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const lines = content.split('\n');
  const topImports = [];
  const topConstants = [];
  const rest = [];
  
  let processingTopLevel = true;
  
  for (const line of lines) {
    if (processingTopLevel) {
      if (line.trim().startsWith('import')) {
        topImports.push(line);
      } else if (line.trim().startsWith('const') && line.includes('=')) {
        topConstants.push(line);
      } else if (line.trim() === '') {
        // Skip empty lines at the top
        if (topImports.length > 0 || topConstants.length > 0) {
          topImports.push(line);
        }
      } else {
        // We've reached the end of top-level imports and constants
        processingTopLevel = false;
        rest.push(line);
      }
    } else {
      rest.push(line);
    }
  }
  
  // Add an empty line between imports and constants if needed
  if (topImports.length > 0 && topConstants.length > 0 && topImports[topImports.length - 1].trim() !== '') {
    topImports.push('');
  }
  
  const correctedContent = [...topImports, ...topConstants, ...rest].join('\n');
  
  if (correctedContent !== content) {
    fs.writeFileSync(filePath, correctedContent);
    console.log(`Corrected import/const order in ${filePath}`);
  } else {
    console.log(`No corrections needed in ${filePath}`);
  }
}

module.exports = { checkAndCorrectOrder };