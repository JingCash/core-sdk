## @jingcash/core-sdk

SDK for interacting with [Jing.Cash](https://app.jing.cash) DEX (Decentralized Exchange) on Stacks.

## Installation

```bash
npm install @jingcash/core-sdk
```

## Configuration

Create a `.env` file in your project root:

```bash
# API access (will be provided by Jing.Cash)
JING_API_URL=<api_url>
JING_API_KEY=<your_jc_key>

# Network and account settings
NETWORK=mainnet
MNEMONIC=<your_seed_phrase>
ACCOUNT_INDEX=0
```

⚠️ Important: Keep your seed phrase secure and never share it. Make sure your .env file is included in .gitignore.

## Features

- Full Jing DEX functionality (spot trading, order management)
- Market monitoring and order tracking
- Private P2P offers with optional expiry
- Automatic token decimal handling
- Comprehensive post-conditions for safe execution
- Detailed console output with unit conversion
- Market discovery and validation

## Market Discovery

```typescript
// Get all available trading pairs
const markets = await sdk.getAvailableMarkets();
// Example Response:
// [
//   {
//     pair: "WELSH-STX",
//     baseToken: {
//       symbol: "WELSH",
//       contract: "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token::welshcorgicoin"
//     },
//     quoteToken: {
//       symbol: "STX",
//       contract: "STX"
//     },
//     status: "active"
//   },
//   // ... more markets
// ]

// Get specific market details
const welshMarket = await sdk.getMarket("WELSH-STX");

// Validate trading pair
const isValid = await sdk.isValidPair("WELSH-STX"); // returns boolean
```

## Usage

```typescript
import { JingCashSDK } from "@jingcash/core-sdk";

const sdk = new JingCashSDK({
  API_HOST: process.env.JING_API_URL,
  API_KEY: process.env.JING_API_KEY,
  defaultAddress: "SP2...", // Your default Stacks address
  network: "mainnet", // or "testnet"
});

// Market Data
const orderBook = await sdk.getOrderBook("PEPE-STX");
const privateOffers = await sdk.getPrivateOffers("PEPE-STX", "SP2...");
const userOffers = await sdk.getUserOffers("PEPE-STX", "SP2...");
const pendingOrders = await sdk.getPendingOrders();

// Trading Operations
const bidResult = await sdk.createBidOffer({
  pair: "PEPE-STX",
  stxAmount: 1.5, // In STX
  tokenAmount: 100000, // In PEPE
  gasFee: 10000, // In uSTX
  mnemonic: process.env.MNEMONIC,
});

const askResult = await sdk.createAskOffer({
  pair: "PEPE-STX",
  tokenAmount: 100000, // In PEPE
  stxAmount: 1.5, // In STX
  gasFee: 10000, // In uSTX
  mnemonic: process.env.MNEMONIC,
});

// Order Management
await sdk.submitBid({
  swapId: 12,
  gasFee: 10000,
  mnemonic: process.env.MNEMONIC,
});
await sdk.submitAsk({
  swapId: 5,
  gasFee: 10000,
  mnemonic: process.env.MNEMONIC,
});
await sdk.cancelBid({
  swapId: 13,
  gasFee: 10000,
  mnemonic: process.env.MNEMONIC,
});
await sdk.cancelAsk({
  swapId: 13,
  gasFee: 10000,
  mnemonic: process.env.MNEMONIC,
});

// Price Updates
await sdk.repriceBid({
  swapId: 1,
  newTokenAmount: 150000,
  pair: "PEPE-STX",
  gasFee: 10000,
  mnemonic: process.env.MNEMONIC,
});

await sdk.repriceAsk({
  swapId: 4,
  newStxAmount: 2.5,
  pair: "PEPE-STX",
  gasFee: 10000,
  mnemonic: process.env.MNEMONIC,
});

// Get Order Details
const bidDetails = await sdk.getBid(0);
const askDetails = await sdk.getAsk(1);
```

## Example Tools & Documentation

The SDK comes with a suite of command-line tools demonstrating its usage. Check out [agent-tools-ts](https://github.com/aibtcdev/agent-tools-ts) for examples:

### Market Data Tools

- `get-market.ts`: Live order book for a trading pair
- `get-private-offers.ts`: View offers sent to your address
- `get-user-offers.ts`: Track your open orders
- `get-pending-orders.ts`: Monitor all pending orders

### Trading Scripts

- `bid.ts`/`ask.ts`: Create new orders
- `submit-bid.ts`/`submit-ask.ts`: Submit to existing orders
- `cancel-bid.ts`/`cancel-ask.ts`: Cancel existing orders
- `reprice-bid.ts`/`reprice-ask.ts`: Update order prices
- `get-bid.ts`/`get-ask.ts`: Get order details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Rapha.btc

```

```
