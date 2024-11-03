"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JingSDK = void 0;
class JingSDK {
    constructor(config) {
        this.apiUrl = config.API_URL;
        this.apiKey = config.API_KEY;
    }
    async fetch(endpoint) {
        const response = await fetch(`${this.apiUrl}${endpoint}`, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "X-API-Key": this.apiKey,
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
    async getOrderBook(pair) {
        const [bidsResponse, asksResponse] = await Promise.all([
            this.fetch(`/token-pairs/${pair}/stx-bids`),
            this.fetch(`/token-pairs/${pair}/stx-asks`),
        ]);
        return {
            bids: bidsResponse.results
                .filter((bid) => bid.status === "open")
                .map(this.formatOrderBookEntry)
                .sort((a, b) => b.price - a.price),
            asks: asksResponse.results
                .filter((ask) => ask.status === "open")
                .map(this.formatOrderBookEntry)
                .sort((a, b) => a.price - b.price),
        };
    }
    formatOrderBookEntry(entry) {
        return {
            id: entry.id,
            amount: entry.amount,
            ustx: entry.ustx,
            price: entry.ustx / entry.amount,
            status: entry.status,
        };
    }
}
exports.JingSDK = JingSDK;
__exportStar(require("./types"), exports);
