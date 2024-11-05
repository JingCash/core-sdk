"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JingCashSDK = void 0;
const token_utils_1 = require("./token-utils");
const constants_1 = require("./constants");
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
    // private formatAmount(amount: number, decimals: number): string {
    //   return (amount / Math.pow(10, decimals)).toString();
    // }
    // private formatPrice(
    //   ustx: number,
    //   amount: number,
    //   inDecimals: number,
    //   outDecimals: number
    // ): string {
    //   return (
    //     ustx /
    //     (amount * Math.pow(10, outDecimals - inDecimals))
    //   ).toString();
    // }
    isStxAsk(order) {
        // If out_contract is "STX", it's an Ask
        return order.out_contract === "STX";
    }
    formatDisplayOrder(order) {
        if (this.isStxAsk(order)) {
            // ASK: Selling tokens for STX (out_contract is STX)
            const tokenAmount = (0, token_utils_1.fromMicroUnits)(order.amount, order.in_decimals);
            const stxAmount = (0, token_utils_1.fromMicroUnits)(order.ustx, constants_1.STX_DECIMALS);
            const tokenSymbol = (0, token_utils_1.getTokenSymbol)(order.in_contract);
            const displayOrder = {
                ...order,
                type: "Ask",
                market: `${tokenSymbol}/STX`,
                displayAmount: `${tokenAmount.toString()} ${tokenSymbol}`,
                displayPrice: `${(stxAmount / tokenAmount).toString()} STX/${tokenSymbol}`, // Changed to STX/Token
            };
            return displayOrder;
        }
        else {
            // BID: Buying tokens with STX (in_contract is STX)
            const tokenAmount = (0, token_utils_1.fromMicroUnits)(order.amount, order.out_decimals);
            const stxAmount = (0, token_utils_1.fromMicroUnits)(order.ustx, constants_1.STX_DECIMALS);
            const tokenSymbol = (0, token_utils_1.getTokenSymbol)(order.out_contract);
            const displayBid = {
                ...order,
                type: "Bid",
                market: `${tokenSymbol}/STX`,
                displayAmount: `${tokenAmount.toString()} ${tokenSymbol}`,
                displayPrice: `${(stxAmount / tokenAmount).toString()} STX/${tokenSymbol}`, // Changed to STX/Token
            };
            return displayBid;
        }
    }
    async getPendingOrders(page = 1, limit = 50) {
        try {
            const response = await this.fetch(`/all-pending-stx-swaps?page=${page}&limit=${limit}`);
            const formattedResults = response.results
                .filter((order) => order.status === "open" || order.status === "private")
                .map((order) => this.formatDisplayOrder(order))
                .sort((a, b) => {
                const dateA = a.processedAt ? a.processedAt : 0;
                const dateB = b.processedAt ? b.processedAt : 0;
                return dateB - dateA;
            });
            return {
                results: formattedResults,
            };
        }
        catch (error) {
            throw new Error(`Failed to fetch pending orders: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    // Other methods remain the same...
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
                .sort((a, b) => a.ustx / a.amount - b.ustx / a.amount),
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
