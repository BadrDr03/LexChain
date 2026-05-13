export {};

type EthereumRequestArgs = {
  method: string;
  params?: unknown[] | object;
};

type EthereumProvider = {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request: (args: EthereumRequestArgs) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
