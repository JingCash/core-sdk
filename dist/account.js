"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveChildAccount = deriveChildAccount;
const wallet_sdk_1 = require("@stacks/wallet-sdk");
async function deriveChildAccount(network, mnemonic, index) {
    const wallet = await (0, wallet_sdk_1.generateWallet)({
        secretKey: mnemonic,
        password: "",
    });
    let walletWithAccounts = wallet;
    for (let i = 0; i <= index; i++) {
        walletWithAccounts = (0, wallet_sdk_1.generateNewAccount)(walletWithAccounts);
    }
    return {
        address: (0, wallet_sdk_1.getStxAddress)({
            account: walletWithAccounts.accounts[index],
            network: network,
        }),
        key: walletWithAccounts.accounts[index].stxPrivateKey,
    };
}
