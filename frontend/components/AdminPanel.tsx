"use client";

import { useState } from "react";

type RoleStatus = {
  isAdmin: boolean;
  isPolice: boolean;
  isJudge: boolean;
};

type AdminPanelProps = {
  canManageRoles: boolean;
  pending: boolean;
  onGrantPolice: (address: string) => Promise<void>;
  onGrantJudge: (address: string) => Promise<void>;
  onRevokePolice: (address: string) => Promise<void>;
  onRevokeJudge: (address: string) => Promise<void>;
  onCheckRoleStatus: (address: string) => Promise<RoleStatus | null>;
};

export default function AdminPanel({
  canManageRoles,
  pending,
  onGrantPolice,
  onGrantJudge,
  onRevokePolice,
  onRevokeJudge,
  onCheckRoleStatus,
}: AdminPanelProps) {
  const [policeAddress, setPoliceAddress] = useState("");
  const [judgeAddress, setJudgeAddress] = useState("");
  const [statusAddress, setStatusAddress] = useState("");
  const [roleStatus, setRoleStatus] = useState<RoleStatus | null>(null);

  const handlePoliceGrant = async () => {
    await onGrantPolice(policeAddress);
    setPoliceAddress("");
  };

  const handleJudgeGrant = async () => {
    await onGrantJudge(judgeAddress);
    setJudgeAddress("");
  };

  const handlePoliceRevoke = async () => {
    await onRevokePolice(policeAddress);
  };

  const handleJudgeRevoke = async () => {
    await onRevokeJudge(judgeAddress);
  };

  const handleCheckStatus = async () => {
    const result = await onCheckRoleStatus(statusAddress);
    if (!result) return;
    setRoleStatus(result);
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-lg shadow-zinc-950/30">
      <h2 className="text-xl font-semibold text-zinc-100">Admin Panel</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Manage access control and verify on-chain role memberships.
      </p>
      {!canManageRoles ? (
        <p className="mt-3 text-sm text-amber-300">
          This section is read-only. Connect with a DEFAULT_ADMIN_ROLE account to grant roles.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="mb-2 text-sm font-medium text-zinc-300">Grant POLICE_ROLE</p>
          <input
            value={policeAddress}
            onChange={(event) => setPoliceAddress(event.target.value)}
            placeholder="0x..."
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void handlePoliceGrant()}
              disabled={!canManageRoles || pending}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
            >
              {pending ? "Processing..." : "Grant Police"}
            </button>
            <button
              onClick={() => void handlePoliceRevoke()}
              disabled={!canManageRoles || pending}
              className="rounded-md border border-red-500/70 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {pending ? "Processing..." : "Revoke Police"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="mb-2 text-sm font-medium text-zinc-300">Grant JUDGE_ROLE</p>
          <input
            value={judgeAddress}
            onChange={(event) => setJudgeAddress(event.target.value)}
            placeholder="0x..."
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void handleJudgeGrant()}
              disabled={!canManageRoles || pending}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
            >
              {pending ? "Processing..." : "Grant Judge"}
            </button>
            <button
              onClick={() => void handleJudgeRevoke()}
              disabled={!canManageRoles || pending}
              className="rounded-md border border-red-500/70 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {pending ? "Processing..." : "Revoke Judge"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <p className="mb-2 text-sm font-medium text-zinc-300">Role Status Check</p>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={statusAddress}
            onChange={(event) => setStatusAddress(event.target.value)}
            placeholder="0x..."
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
          />
          <button
            onClick={() => void handleCheckStatus()}
            disabled={pending}
            className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Check Status
          </button>
        </div>
        {roleStatus ? (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span
              className={`rounded-full px-3 py-1 ${roleStatus.isAdmin ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}
            >
              Admin: {roleStatus.isAdmin ? "Yes" : "No"}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${roleStatus.isPolice ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}
            >
              Police: {roleStatus.isPolice ? "Yes" : "No"}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${roleStatus.isJudge ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}
            >
              Judge: {roleStatus.isJudge ? "Yes" : "No"}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
