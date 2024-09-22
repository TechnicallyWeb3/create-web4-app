#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { program } = require('commander');

program
  .version('1.2.5')
  .argument('<project-directory>', 'Project directory name')
  .parse(process.argv);

const projectName = program.args[0];

if (!projectName) {
  console.error('Please specify the project directory:');
  console.log(
    `  ${chalk.cyan('npx')} create-react-web4-app ${chalk.green('<project-directory>')}`
  );
  process.exit(1);
}

const currentDir = process.cwd();
const projectDir = path.resolve(currentDir, projectName);

if (fs.existsSync(projectDir)) {
  console.error(`The directory ${chalk.green(projectName)} already exists.`);
  process.exit(1);
}

console.log(`Creating a new Web4 app in ${chalk.green(projectDir)}.`);

// Create project directory
fs.mkdirSync(projectDir, { recursive: true });

// Copy template files
const templateDir = path.resolve(__dirname, '../templates');
fs.copySync(templateDir, projectDir);

// Rename gitignore to .gitignore
fs.renameSync(
  path.join(projectDir, 'gitignore'),
  path.join(projectDir, '.gitignore')
);

// Install dependencies
console.log('Installing dependencies...');
process.chdir(projectDir);
execSync('npm install', { stdio: 'inherit' });

console.log(chalk.green('Success!') + ' Created ' + projectName + ' at ' + projectDir);
console.log('Inside that directory, you can run several commands:');
console.log();
console.log(chalk.cyan('  npm start'));
console.log('    Starts the development server.');
console.log();
console.log(chalk.cyan('  npm run build'));
console.log('    Bundles the app into static files for production.');
console.log();
console.log(chalk.cyan('  npm run deploy-contract'));
console.log('    Deploys the contract to Mumbai testnet.');
console.log();
console.log(chalk.cyan('  npm run upload-website'));
console.log('    Uploads the website to the deployed contract.');
console.log();
console.log('We suggest that you begin by typing:');
console.log();
console.log(chalk.cyan('  cd'), projectName);
console.log('  ' + chalk.cyan('npm start'));
console.log();
console.log('Happy hacking!');