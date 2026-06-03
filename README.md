# NourBridge - Fiat to Web3 & Bank Transfer Platform

NourBridge is a comprehensive platform that seamlessly bridges traditional finance (Fiat) with Web3 (Cryptocurrency) and bank transfers.

## 🎯 Features

### Fiat ↔ Web3 Services
- Convert fiat currency to cryptocurrency
- Convert cryptocurrency back to fiat
- Support for multiple blockchain networks (Ethereum, Polygon, BSC, etc.)
- Real-time exchange rates

### Fiat ↔ Bank Transfer Services
- Direct bank transfers
- Multiple payment methods
- KYC/AML compliance
- Transaction history and reports

### Core Infrastructure
- Stripe payment integration
- Smart contract handlers
- User authentication & authorization
- Transaction management
- Wallet integration

## 📁 Project Structure

```
NourBridge/
├── contracts/              # Solidity smart contracts
│   ├── BridgeToken.sol
│   ├── FiatBridge.sol
│   └── SwapRouter.sol
├── backend/                # Node.js/Express backend
│   ├── routes/
│   │   ├── auth.js
│   │   ├── payments.js
│   │   ├── transfers.js
│   │   ├── wallet.js
│   │   └── transactions.js
│   ├── controllers/
│   ├── services/
│   ├── models/
│   └── middleware/
├── frontend/               # React/Next.js frontend
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── utils/
├── test/                   # Smart contract tests
├── scripts/                # Deployment scripts
├── Dockerfile
└── package.json
```

## 🔧 Tech Stack

- **Backend**: Node.js, Express, MongoDB
- **Frontend**: React, Web3.js, Ethers.js
- **Blockchain**: Solidity, Hardhat, Web3
- **Payments**: Stripe API
- **Banking**: Stripe Connect
- **Deployment**: Docker, Docker Compose

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env

# Run development server
npm run dev

# Deploy smart contracts
npm run deploy:contracts

# Start frontend
npm run dev:frontend
```

## 📚 Documentation

- [Stripe Integration Guide](./STRIPE_INTEGRATION.md)
- [Smart Contract Documentation](./docs/CONTRACTS.md)
- [API Documentation](./docs/API.md)
- [Architecture Guide](./docs/ARCHITECTURE.md)

## 📄 License

Apache License 2.0
