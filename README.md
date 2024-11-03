# @jingcash/core-sdk

SDK for interacting with [Jing.Cash](https://app.jing.cash) DEX (Decentralized Exchange) on Stacks.

## Installation

```bash
npm install @jingcash/core-sdk
```

## Usage

```typescript
import { JingcashSDK } from "@jingcash/core-sdk";

// Initialize the SDK
const jingcash = new JingcashSDK({
  API_HOST: process.env.JING_API_URL, // e.g., "https://backend-neon-ecru.vercel.app/api"
  API_KEY: process.env.JING_API_KEY, // e.g., "dev-api-token"
});

// Get order book for a trading pair
const orderBook = await jingcash.getOrderBook("PEPE-STX");
console.log("Order Book:", orderBook);

// Get private offers for a user
const privateOffers = await jingcash.getPrivateOffers(
  "PEPE-STX", // Trading pair
  "SP2...", // User's Stacks address
  "SP2...token-contract" // Token contract
);
console.log("Private Offers:", privateOffers);

// Get user's offers
const userOffers = await jingcash.getUserOffers(
  "PEPE-STX", // Trading pair
  "SP2...", // User's Stacks address
  "SP2...token-contract" // Token contract
);
console.log("User Offers:", userOffers);
```

## API Reference

### `JingcashSDK`

#### Constructor

```typescript
new JingcashSDK({
  API_HOST: string;  // Jing.Cash API endpoint
  API_KEY: string;   // API key for authentication
})
```

#### Methods

##### `getOrderBook(pair: string): Promise<OrderBook>`

Get the order book for a trading pair.

- `pair`: Trading pair identifier (e.g., "PEPE-STX")
- Returns: Promise resolving to an OrderBook object containing bids and asks

##### `getPrivateOffers(pair: string, userAddress: string, ftContract: string): Promise<PrivateOffersResponse>`

Get private offers for a specific user.

- `pair`: Trading pair identifier
- `userAddress`: Stacks address of the user
- `ftContract`: Token contract
- Returns: Promise resolving to private bids and asks

##### `getUserOffers(pair: string, userAddress: string, ftContract: string): Promise<UserOffersResponse>`

Get all offers for a specific user.

- `pair`: Trading pair identifier
- `userAddress`: Stacks address of the user
- `ftContract`: Token contract
- Returns: Promise resolving to user's bids and asks

## Types

```typescript
interface OrderBook {
  bids: StacksBid[];
  asks: StxAsk[];
}

interface PrivateOffersResponse {
  privateBids: StacksBid[];
  privateAsks: StxAsk[];
}

interface UserOffersResponse {
  userBids: StacksBid[];
  userAsks: StxAsk[];
}
```

## Example Tools

Check out [agent-tools-ts](https://github.com/aibtcdev/agent-tools-ts) for example command-line tools using this SDK:

- `get-market.ts`: Get current order book for a trading pair
- `get-private-offers.ts`: Get private offers for a specific user
- `get-user-offers.ts`: Get all offers for a specific user

## License

MIT

## Author

Rapha.btc
