# LexChain Pro

A blockchain-based legal evidence management system. The `LexChain` smart contract stores evidence metadata on-chain with role-based access control, while a Next.js frontend allows authorized users to submit and view evidence through MetaMask.

**Lead Developer:** `<your name>`

## Features

- Role-based permissions using OpenZeppelin `AccessControl`
- On-chain storage of evidence metadata (`ipfsCID`, file hash, case number, timestamp)
- IPFS file upload flow via Pinata integration
- Admin panel for assigning `POLICE_ROLE` and `JUDGE_ROLE`
- Evidence submission and dashboard views in a modern Next.js frontend

## Installation

### Prerequisites

- Node.js 18 or newer
- npm
- [MetaMask](https://metamask.io/)
- [Pinata](https://pinata.cloud/) account

### 1) Install root dependencies

```bash
npm install
```

### 2) Install frontend dependencies

```bash
cd frontend
npm install
```

### 3) Configure environment variables

Create `frontend/.env.local`:

```env
PINATA_JWT=<your_pinata_jwt_token>
```

## Usage

### 1) Start a local blockchain

```bash
npx hardhat node
```

### 2) Deploy the contract

In a separate terminal:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

### 3) Run the frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4) Connect MetaMask

- Add **Hardhat Localhost** with RPC URL `http://127.0.0.1:8545` and Chain ID `31337`
- Import a Hardhat test account private key (shown when running `npx hardhat node`)
- Use account `#0` as admin to grant roles from the Admin panel

### Common commands

```bash
npx hardhat compile
npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

```bash
cd frontend
npm run dev
npm run build
npm run lint
```
