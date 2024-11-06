import { NetworkType } from "./network-types";
import {
  generateNewAccount,
  generateWallet,
  getStxAddress,
} from "@stacks/wallet-sdk";

export async function deriveChildAccount(
  network: NetworkType,
  mnemonic: string,
  index: number
) {
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });

  let walletWithAccounts = wallet;
  for (let i = 0; i <= index; i++) {
    walletWithAccounts = generateNewAccount(walletWithAccounts);
  }

  return {
    address: getStxAddress({
      account: walletWithAccounts.accounts[index],
      network: network,
    }),
    key: walletWithAccounts.accounts[index].stxPrivateKey,
  };
}
