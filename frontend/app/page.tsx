"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, isAddress } from "ethers";
import { FileCheck2, LayoutDashboard, Lock, ShieldCheck } from "lucide-react";
import AdminPanel from "@/components/AdminPanel";
import EvidenceForm from "@/components/EvidenceForm";
import EvidenceList from "@/components/EvidenceList";
import Navbar from "@/components/Navbar";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const HARDHAT_CHAIN_ID = 31337n;
const HARDHAT_CHAIN_ID_HEX = "0x7A69";

type EvidenceItem = {
  ipfsCID: string;
  fileHash: string;
  caseNumber: string;
  addedBy: string;
  timestamp: number;
  fileName?: string;
  fileType?: string;
};

type EvidenceAddedEvent = {
  args?: {
    ipfsCID?: string;
  };
};

type RoleStatus = {
  isAdmin: boolean;
  isPolice: boolean;
  isJudge: boolean;
};

type TabId = "dashboard" | "submit" | "admin";
type FileMetadata = { fileName: string; fileType: string };
type FileMetadataStore = Record<string, FileMetadata>;
type EthereumProvider = NonNullable<Window["ethereum"]>;

const FILE_METADATA_STORAGE_KEY = "lexchain:file-metadata";

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readFileMetadataStore(): FileMetadataStore {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(FILE_METADATA_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as FileMetadataStore;
  } catch {
    return {};
  }
}

function writeFileMetadataStore(store: FileMetadataStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FILE_METADATA_STORAGE_KEY, JSON.stringify(store));
}

function normalizeChainId(chainId: unknown): bigint | null {
  if (typeof chainId === "bigint") return chainId;
  if (typeof chainId === "number") return BigInt(chainId);
  if (typeof chainId === "string") {
    try {
      return chainId.startsWith("0x") || chainId.startsWith("0X")
        ? BigInt(chainId)
        : BigInt(parseInt(chainId, 10));
    } catch {
      return null;
    }
  }
  return null;
}

function getInjectedProvider(): EthereumProvider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;

  const { ethereum } = window;
  if (ethereum.providers?.length) {
    const metaMaskProvider = ethereum.providers.find((provider) => provider.isMetaMask);
    return metaMaskProvider ?? ethereum.providers[0] ?? null;
  }
  return ethereum;
}

function normalizeErrorMessage(error: unknown) {
  const fallback = "Transaction failed. Please try again.";
  if (!error || typeof error !== "object") return fallback;

  const errorObject = error as { shortMessage?: string; message?: string };
  const message = errorObject.shortMessage ?? errorObject.message ?? fallback;

  if (message.includes("AccessControlUnauthorizedAccount")) {
    return "Permission denied for this account role.";
  }
  if (message.includes("NotAuthorized")) {
    return "Only judges or admins can view evidence.";
  }
  if (message.includes("Evidence already exists")) {
    return "Evidence already exists for this CID (overwrites are blocked).";
  }
  return message;
}

export default function Home() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [injectedProvider, setInjectedProvider] = useState<EthereumProvider | null>(null);
  const [abi, setAbi] = useState<readonly unknown[] | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [adminTxPending, setAdminTxPending] = useState(false);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [isAdminAccount, setIsAdminAccount] = useState(false);
  const [canViewEvidence, setCanViewEvidence] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [requiresNetworkSwitch, setRequiresNetworkSwitch] = useState(false);

  const contract = useMemo(() => {
    if (!provider || !abi) return null;
    return new Contract(CONTRACT_ADDRESS, abi, provider);
  }, [provider, abi]);

  const ensureHardhatNetwork = useCallback(async (providerOverride?: BrowserProvider) => {
    const providerToCheck = providerOverride ?? provider;
    if (!providerToCheck) return false;
    const network = await providerToCheck.getNetwork();
    const rpcChainId = injectedProvider
      ? await injectedProvider.request({ method: "eth_chainId" })
      : await providerToCheck.send("eth_chainId", []);
    const networkChainId = normalizeChainId(network.chainId);
    const rpcNormalizedChainId = normalizeChainId(rpcChainId);
    const currentChainId = rpcNormalizedChainId ?? networkChainId;

    console.log("Current Chain ID:", currentChainId?.toString(), {
      ethersNetworkChainId: network.chainId?.toString(),
      rpcChainId,
    });

    if (currentChainId !== HARDHAT_CHAIN_ID) {
      setNotice("Please switch MetaMask to Hardhat Localhost (Chain ID 31337).");
      setRequiresNetworkSwitch(true);
      return false;
    }
    setNotice("");
    setRequiresNetworkSwitch(false);
    return true;
  }, [injectedProvider, provider]);

  const switchToHardhatNetwork = useCallback(async () => {
    const walletProvider = injectedProvider ?? getInjectedProvider();
    if (!walletProvider) {
      setNotice("No wallet detected. Install MetaMask to use LexChain.");
      return;
    }

    try {
      await walletProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_ID_HEX }],
      });
      setRequiresNetworkSwitch(false);
      setNotice("Switched to Hardhat Localhost.");
    } catch (error) {
      const errorCode =
        typeof error === "object" && error && "code" in error
          ? (error as { code?: number }).code
          : undefined;

      if (errorCode === 4902) {
        try {
          await walletProvider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: HARDHAT_CHAIN_ID_HEX,
                chainName: "Hardhat Localhost",
                rpcUrls: ["http://127.0.0.1:8545"],
                nativeCurrency: {
                  name: "Ether",
                  symbol: "ETH",
                  decimals: 18,
                },
              },
            ],
          });
          setRequiresNetworkSwitch(false);
          setNotice("Hardhat Localhost added. Please connect wallet again.");
          return;
        } catch {
          setNotice("Failed to add Hardhat network in MetaMask.");
          return;
        }
      }

      setNotice("Network switch was rejected or failed.");
    }
  }, [injectedProvider]);

  const loadEvidence = useCallback(async () => {
    if (!contract) return;
    const onHardhat = await ensureHardhatNetwork();
    if (!onHardhat) return;
    setLoadingEvidence(true);

    try {
      if (!account) {
        setEvidenceItems([]);
        setNotice("Connect a Judge/Admin wallet to view evidence.");
        return;
      }
      const [adminRole, judgeRole] = await Promise.all([
        contract.DEFAULT_ADMIN_ROLE(),
        contract.JUDGE_ROLE(),
      ]);
      const [isAdmin, isJudge] = await Promise.all([
        contract.hasRole(adminRole, account),
        contract.hasRole(judgeRole, account),
      ]);
      const allowed = Boolean(isAdmin || isJudge);
      setCanViewEvidence(allowed);
      if (!allowed) {
        setEvidenceItems([]);
        setNotice("Only judges or admins can view evidence.");
        return;
      }

      const eventFilter = contract.filters.EvidenceAdded();
      const events = (await contract.queryFilter(eventFilter)) as EvidenceAddedEvent[];
      const uniqueCids = [
        ...new Set(events.map((event) => event.args?.ipfsCID).filter(isString)),
      ];

      const items = await Promise.all(
        uniqueCids.map(async (cid) => {
          const evidence = await contract.getEvidence(cid);
          const metadata = readFileMetadataStore()[cid];
          return {
            ipfsCID: evidence.ipfsCID,
            fileHash: evidence.fileHash,
            caseNumber: evidence.caseNumber,
            addedBy: evidence.addedBy,
            timestamp: Number(evidence.timestamp),
            fileName: metadata?.fileName,
            fileType: metadata?.fileType,
          };
        })
      );

      setEvidenceItems(items.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
    } finally {
      setLoadingEvidence(false);
    }
  }, [account, contract, ensureHardhatNetwork]);

  const checkRoleStatus = useCallback(
    async (address: string): Promise<RoleStatus | null> => {
      if (!contract) {
        setNotice("Contract is not ready.");
        return null;
      }
      if (!isAddress(address)) {
        setNotice("Enter a valid wallet address.");
        return null;
      }
      const onHardhat = await ensureHardhatNetwork();
      if (!onHardhat) return null;

      try {
        const [adminRole, policeRole, judgeRole] = await Promise.all([
          contract.DEFAULT_ADMIN_ROLE(),
          contract.POLICE_ROLE(),
          contract.JUDGE_ROLE(),
        ]);

        const [isAdmin, isPolice, isJudge] = await Promise.all([
          contract.hasRole(adminRole, address),
          contract.hasRole(policeRole, address),
          contract.hasRole(judgeRole, address),
        ]);

        return { isAdmin, isPolice, isJudge };
      } catch {
        setNotice("Failed to fetch role status.");
        return null;
      }
    },
    [contract, ensureHardhatNetwork]
  );

  useEffect(() => {
    const initialize = async () => {
      const detectedProvider = getInjectedProvider();
      if (!detectedProvider) {
        setNotice("No wallet detected. Install MetaMask to use LexChain.");
        return;
      }

      try {
        const response = await fetch("/api/contract");
        if (!response.ok) throw new Error("ABI load failed");

        const data = (await response.json()) as { abi: readonly unknown[] };
        setAbi(data.abi);
        setInjectedProvider(detectedProvider);
        setProvider(new BrowserProvider(detectedProvider));
        setNotice("");
      } catch {
        setNotice("Unable to initialize contract connection.");
      }
    };

    void initialize();
  }, []);

  useEffect(() => {
    if (!injectedProvider?.on || !injectedProvider?.removeListener || !provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      void (async () => {
        const nextAccount =
          Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
        setAccount(nextAccount);

        if (!nextAccount) {
          setIsAdminAccount(false);
          setCanViewEvidence(false);
          setEvidenceItems([]);
          if (activeTab === "admin") setActiveTab("dashboard");
          return;
        }

        const onHardhat = await ensureHardhatNetwork(provider);
        if (!onHardhat) {
          setIsAdminAccount(false);
          setCanViewEvidence(false);
          setEvidenceItems([]);
          if (activeTab === "admin") setActiveTab("dashboard");
          return;
        }

        try {
          const [adminRole, judgeRole] = await Promise.all([
            contract?.DEFAULT_ADMIN_ROLE(),
            contract?.JUDGE_ROLE(),
          ]);

          if (!adminRole || !judgeRole || !contract) return;

          const [isAdmin, isJudge] = await Promise.all([
            contract.hasRole(adminRole, nextAccount),
            contract.hasRole(judgeRole, nextAccount),
          ]);
          setIsAdminAccount(isAdmin);
          setCanViewEvidence(Boolean(isAdmin || isJudge));
          if (!isAdmin && activeTab === "admin") setActiveTab("dashboard");
        } catch {
          setIsAdminAccount(false);
          setCanViewEvidence(false);
          setEvidenceItems([]);
          if (activeTab === "admin") setActiveTab("dashboard");
        }
      })();
    };

    const handleChainChanged = () => {
      void (async () => {
        const onHardhat = await ensureHardhatNetwork(provider);
        if (!onHardhat) {
          setAccount(null);
          return;
        }
        try {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);
          setNotice("");
        } catch {
          setAccount(null);
        }
      })();
    };

    injectedProvider.on("accountsChanged", handleAccountsChanged);
    injectedProvider.on("chainChanged", handleChainChanged);

    return () => {
      injectedProvider.removeListener?.("accountsChanged", handleAccountsChanged);
      injectedProvider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [activeTab, contract, ensureHardhatNetwork, injectedProvider, provider]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEvidence();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadEvidence]);

  const connectWallet = useCallback(async () => {
    const walletProvider = injectedProvider ?? getInjectedProvider();
    if (!walletProvider) {
      setNotice("No wallet detected. Install MetaMask to use LexChain.");
      return;
    }
    const connectedProvider = provider ?? new BrowserProvider(walletProvider);
    if (!provider) {
      setProvider(connectedProvider);
      setInjectedProvider(walletProvider);
    }
    if (!connectedProvider) {
      setNotice("Provider is not ready yet.");
      return;
    }

    setConnecting(true);
    try {
      await connectedProvider.send("eth_requestAccounts", []);

      const directChainId = walletProvider
        ? await walletProvider.request({ method: "eth_chainId" })
        : await connectedProvider.send("eth_chainId", []);
      const normalizedDirectChainId = normalizeChainId(directChainId);
      console.log("Current Chain ID:", normalizedDirectChainId?.toString(), {
        directChainId,
      });

      if (normalizedDirectChainId !== HARDHAT_CHAIN_ID) {
        setRequiresNetworkSwitch(true);
        setNotice("Please switch MetaMask to Hardhat Localhost (Chain ID 31337).");
        return;
      }

      const onHardhat = await ensureHardhatNetwork(connectedProvider);
      if (!onHardhat) return;
      const signer = await connectedProvider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      setNotice("");
      setRequiresNetworkSwitch(false);
    } catch {
      setNotice("Wallet connection was rejected.");
    } finally {
      setConnecting(false);
    }
  }, [ensureHardhatNetwork, injectedProvider, provider]);

  useEffect(() => {
    const syncConnectedAccountRole = async () => {
      if (!account) {
        setIsAdminAccount(false);
        setCanViewEvidence(false);
        if (activeTab === "admin") setActiveTab("dashboard");
        return;
      }
      const status = await checkRoleStatus(account);
      const isAdmin = Boolean(status?.isAdmin);
      setIsAdminAccount(isAdmin);
      setCanViewEvidence(Boolean(status?.isAdmin || status?.isJudge));
      if (!isAdmin && activeTab === "admin") {
        setActiveTab("dashboard");
      }
    };

    void syncConnectedAccountRole();
  }, [account, activeTab, checkRoleStatus]);

  const handleSubmitEvidence = useCallback(
    async ({
      caseNumber,
      ipfsCID,
      fileHash,
      fileName,
      fileType,
    }: {
      caseNumber: string;
      ipfsCID: string;
      fileHash: string;
      fileName: string;
      fileType: string;
    }) => {
      if (!provider || !contract) {
        setNotice("Contract is not ready.");
        return;
      }
      if (!account) {
        setNotice("Connect wallet before submitting evidence.");
        return;
      }
      const onHardhat = await ensureHardhatNetwork();
      if (!onHardhat) return;

      setTxPending(true);
      try {
        const signer = await provider.getSigner();
        const writableContract = contract.connect(signer);
        const tx = await writableContract.addEvidence(ipfsCID, fileHash, caseNumber);
        await tx.wait();
        const metadataStore = readFileMetadataStore();
        metadataStore[ipfsCID] = { fileName, fileType };
        writeFileMetadataStore(metadataStore);

        setNotice("Evidence submitted successfully.");
        alert("Evidence submitted successfully.");
        await loadEvidence();
      } catch (error) {
        const message = normalizeErrorMessage(error);
        setNotice(message);
        alert(message);
      } finally {
        setTxPending(false);
      }
    },
    [account, contract, ensureHardhatNetwork, loadEvidence, provider]
  );

  const grantRoleByType = useCallback(
    async (targetAddress: string, role: "POLICE" | "JUDGE") => {
      if (!provider || !contract) {
        setNotice("Contract is not ready.");
        return;
      }
      if (!account) {
        setNotice("Connect wallet before granting roles.");
        return;
      }
      if (!isAddress(targetAddress)) {
        setNotice("Enter a valid wallet address.");
        return;
      }
      const onHardhat = await ensureHardhatNetwork();
      if (!onHardhat) return;
      if (!isAdminAccount) {
        setNotice("Only admin can grant roles.");
        alert("Only admin can grant roles.");
        return;
      }

      setAdminTxPending(true);
      try {
        const signer = await provider.getSigner();
        const writableContract = contract.connect(signer);
        const tx =
          role === "POLICE"
            ? await writableContract.grantPoliceRole(targetAddress)
            : await writableContract.grantJudgeRole(targetAddress);
        await tx.wait();

        const grantedRole = role === "POLICE" ? "POLICE_ROLE" : "JUDGE_ROLE";
        setNotice(`${grantedRole} granted successfully.`);
        alert(`${grantedRole} granted successfully.`);
      } catch (error) {
        const message = normalizeErrorMessage(error);
        setNotice(message);
        alert(message);
      } finally {
        setAdminTxPending(false);
      }
    },
    [account, contract, ensureHardhatNetwork, isAdminAccount, provider]
  );

  const revokeRoleByType = useCallback(
    async (targetAddress: string, role: "POLICE" | "JUDGE") => {
      if (!provider || !contract) {
        setNotice("Contract is not ready.");
        return;
      }
      if (!account) {
        setNotice("Connect wallet before revoking roles.");
        return;
      }
      if (!isAddress(targetAddress)) {
        setNotice("Enter a valid wallet address.");
        return;
      }
      const onHardhat = await ensureHardhatNetwork();
      if (!onHardhat) return;
      if (!isAdminAccount) {
        setNotice("Only admin can revoke roles.");
        alert("Only admin can revoke roles.");
        return;
      }

      setAdminTxPending(true);
      try {
        const signer = await provider.getSigner();
        const writableContract = contract.connect(signer);
        const roleBytes =
          role === "POLICE" ? await contract.POLICE_ROLE() : await contract.JUDGE_ROLE();
        const tx = await writableContract.revokeRole(roleBytes, targetAddress);
        await tx.wait();

        const revokedRole = role === "POLICE" ? "POLICE_ROLE" : "JUDGE_ROLE";
        setNotice(`${revokedRole} revoked successfully.`);
        alert(`${revokedRole} revoked successfully.`);
      } catch (error) {
        const message = normalizeErrorMessage(error);
        setNotice(message);
        alert(message);
      } finally {
        setAdminTxPending(false);
      }
    },
    [account, contract, ensureHardhatNetwork, isAdminAccount, provider]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-950 text-zinc-100">
      <Navbar account={account} connecting={connecting} onConnect={connectWallet} />

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 md:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-lg shadow-zinc-950/30">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Navigation
          </p>
          <nav className="grid gap-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                activeTab === "dashboard"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("submit")}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                activeTab === "submit"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <FileCheck2 className="h-4 w-4" />
              Submit Evidence
            </button>
            <button
              onClick={() => {
                if (!isAdminAccount) return;
                setActiveTab("admin");
              }}
              disabled={!isAdminAccount}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                activeTab === "admin" && isAdminAccount
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-zinc-300 hover:bg-zinc-800"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isAdminAccount ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Admin Settings
            </button>
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col gap-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-sm text-zinc-300">
              Contract address:{" "}
              <span className="font-mono text-emerald-300">{CONTRACT_ADDRESS}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Configured for Hardhat Localhost (Chain ID 31337).
            </p>
            {notice ? <p className="mt-2 text-sm text-emerald-300">{notice}</p> : null}
            {requiresNetworkSwitch ? (
              <button
                onClick={() => void switchToHardhatNetwork()}
                className="mt-3 rounded-md border border-amber-400/70 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
              >
                Switch to Hardhat Network
              </button>
            ) : null}
          </div>

          {activeTab === "dashboard" ? (
            canViewEvidence ? (
              <EvidenceList items={evidenceItems} loading={loadingEvidence} />
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-lg shadow-zinc-950/30">
                <h2 className="text-xl font-semibold text-zinc-100">Evidence Registry</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Only accounts with <span className="font-medium text-emerald-300">JUDGE_ROLE</span>{" "}
                  or <span className="font-medium text-emerald-300">DEFAULT_ADMIN_ROLE</span> can
                  view evidence.
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  Connect an authorized wallet, then reload the dashboard.
                </p>
              </div>
            )
          ) : null}

          {activeTab === "submit" ? (
            <EvidenceForm
              connected={Boolean(account)}
              txPending={txPending}
              onSubmitEvidence={handleSubmitEvidence}
            />
          ) : null}

          {activeTab === "admin" && isAdminAccount ? (
            <AdminPanel
              canManageRoles={isAdminAccount}
              pending={adminTxPending}
              onGrantPolice={async (address) => grantRoleByType(address, "POLICE")}
              onGrantJudge={async (address) => grantRoleByType(address, "JUDGE")}
              onRevokePolice={async (address) => revokeRoleByType(address, "POLICE")}
              onRevokeJudge={async (address) => revokeRoleByType(address, "JUDGE")}
              onCheckRoleStatus={checkRoleStatus}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
