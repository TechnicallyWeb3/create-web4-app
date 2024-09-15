
## Setup

1. Fill in the values in the `.env` file:
   - `PINATA_API_KEY`: Your Pinata API key for IPFS storage
   - `PINATA_SECRET_API_KEY`: Your Pinata secret API key
   - `PINATA_GATEWAY`: Your Pinata gateway URL
   - `CONTRACT_ADDRESS`: Your deployment contract address
   - `PRIVATE_KEY`: Your Ethereum wallet private key
   - `INFURA_API`: Your Infura API key for Ethereum network access

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

## Deployment

To deploy your app to a decentralized network:

1. Build and deploy:
   ```
   npm run deploy
   ```

This command will:
- Upload images and assets to IPFS
- Build the React app
- Deploy the website to a smart contract

## What's Included

- React app scaffolding
- Web3 integration
- IPFS asset uploading
- Smart contract deployment scripts

## Learn More

- [React documentation](https://reactjs.org/)
- [Web3.js documentation](https://web3js.readthedocs.io/)
- [IPFS documentation](https://docs.ipfs.io/)

## License

This project is open source and available under the [MIT License](LICENSE).