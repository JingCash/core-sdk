"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JingCashSDK = void 0;
const token_utils_1 = require("./token-utils");
class JingCashSDK {
    constructor(config) {
        this.API_HOST = config.API_HOST;
        this.API_KEY = config.API_KEY;
    }
    async fetch(endpoint) {
        const response = await fetch(`${this.API_HOST}${endpoint}`, {
            headers: {
                Authorization: `Bearer ${this.API_KEY}`,
                "X-API-Key": this.API_KEY,
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
    async getOrderBook(pair) {
        if (!(0, token_utils_1.getSupportedPairs)().includes(pair)) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        const [bidsResponse, asksResponse] = await Promise.all([
            this.fetch(`/token-pairs/${pair}/stx-bids`),
            this.fetch(`/token-pairs/${pair}/stx-asks`),
        ]);
        return {
            bids: bidsResponse.results
                .filter((bid) => bid.status === "open" && bid.open)
                .sort((a, b) => b.ustx / b.amount - a.ustx / a.amount),
            asks: asksResponse.results
                .filter((ask) => ask.status === "open" && ask.open)
                .sort((a, b) => a.ustx / a.amount - b.ustx / b.amount),
        };
    }
    async getPrivateOffers(pair, userAddress) {
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        const ftContract = `${tokenInfo.contractAddress}.${tokenInfo.contractName}`;
        return this.fetch(`/token-pairs/${pair}/private-offers?userAddress=${userAddress}&ftContract=${ftContract}`);
    }
    async getUserOffers(pair, userAddress) {
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        const ftContract = `${tokenInfo.contractAddress}.${tokenInfo.contractName}`;
        return this.fetch(`/token-pairs/${pair}/user-offers?userAddress=${userAddress}&ftContract=${ftContract}`);
    }
}
exports.JingCashSDK = JingCashSDK;
