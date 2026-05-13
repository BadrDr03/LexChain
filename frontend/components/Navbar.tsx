"use client";

type NavbarProps = {
  account: string | null;
  connecting: boolean;
  onConnect: () => Promise<void>;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-3)}`;
}

export default function Navbar({ account, connecting, onConnect }: NavbarProps) {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-lg font-semibold tracking-wide text-zinc-100">LexChain</p>
          <p className="text-xs text-zinc-400">Evidence Integrity Dashboard</p>
        </div>
        <button
          onClick={() => void onConnect()}
          disabled={connecting}
          className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {account ? shortAddress(account) : connecting ? "Connecting..." : "Connect Wallet"}
        </button>
      </div>
    </header>
  );
}
