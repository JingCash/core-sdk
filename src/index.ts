import { JingSDKConfig, OrderBook, OrderBookEntry } from "./types";

// Add interface for API response
interface ApiResponse {
  results: Array<{
    id: number;
    amount: number;
    ustx: number;
    status: string;
    [key: string]: any; // for any additional fields
  }>;
}

export class JingSDK {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(config: JingSDKConfig) {
    this.apiUrl = config.API_URL;
    this.apiKey = config.API_KEY;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "X-API-Key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getOrderBook(pair: string): Promise<OrderBook> {
    const [bidsResponse, asksResponse] = await Promise.all([
      this.fetch<ApiResponse>(`/token-pairs/${pair}/stx-bids`),
      this.fetch<ApiResponse>(`/token-pairs/${pair}/stx-asks`),
    ]);

    return {
      bids: bidsResponse.results
        .filter((bid) => bid.status === "open")
        .map(this.formatOrderBookEntry)
        .sort((a: OrderBookEntry, b: OrderBookEntry) => b.price - a.price),
      asks: asksResponse.results
        .filter((ask) => ask.status === "open")
        .map(this.formatOrderBookEntry)
        .sort((a: OrderBookEntry, b: OrderBookEntry) => a.price - b.price),
    };
  }

  private formatOrderBookEntry(
    entry: ApiResponse["results"][0]
  ): OrderBookEntry {
    return {
      id: entry.id,
      amount: entry.amount,
      ustx: entry.ustx,
      price: entry.ustx / entry.amount,
      status: entry.status,
    };
  }
}

export * from "./types";
