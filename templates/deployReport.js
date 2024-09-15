const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

class DeployReport {
  constructor() {
    this.startTime = Date.now();
    this.initialBalance = 0;
    this.finalBalance = 0;
    this.contractFilesSize = 0;
    this.pinataFilesSize = 0;
  }

  async setInitialBalance(provider, address) {
    this.initialBalance = await provider.getBalance(address);
  }

  async setFinalBalance(provider, address) {
    this.finalBalance = await provider.getBalance(address);
  }

  addContractFileSize(size) {
    this.contractFilesSize += size;
  }

  addPinataFileSize(size) {
    this.pinataFilesSize += size;
  }

  setDeploymentCost(cost) {
    this.deploymentCost = cost;
  }

  setContractAddress(address){
    this.deployedContractAddress = address
  }

  async generateReport() {
    const endTime = Date.now();
    const totalTime = (endTime - this.startTime) / 1000; // Convert to seconds

    const report = `
Deployment Report
=================
Date: ${new Date().toISOString()}

Total time taken: ${totalTime.toFixed(2)} seconds
Total cost of deployment: ${this.deploymentCost} MATIC
Total size of files uploaded to contract: ${(this.contractFilesSize / 1024).toFixed(2)} KB
Total size of files uploaded to Pinata: ${(this.pinataFilesSize / 1024).toFixed(2)} KB
Deployed Contract Address: ${this.deployedContractAddress}
`;

    const reportPath = path.join(process.cwd(), 'deploy-report.txt');
    fs.writeFileSync(reportPath, report);
    console.log(`Deployment report saved to: ${reportPath}`);
  }
}

module.exports = new DeployReport();