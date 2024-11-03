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
exports.JingCashSDK = void 0;
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
    async getPrivateOffers(pair, userAddress, ftContract) {
        const response = await this.fetch(`/token-pairs/${pair}/private-offers?userAddress=${userAddress}&ftContract=${ftContract}`);
        return response;
    }
    async getUserOffers(pair, userAddress, ftContract) {
        const response = await this.fetch(`/token-pairs/${pair}/user-offers?userAddress=${userAddress}&ftContract=${ftContract}`);
        return response;
    }
}
exports.JingCashSDK = JingCashSDK;
__exportStar(require("./types"), exports);
