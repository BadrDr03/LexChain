"use client";

import { useState } from "react";
import { ExternalLink, ImageIcon } from "lucide-react";

type EvidenceItem = {
  ipfsCID: string;
  fileHash: string;
  caseNumber: string;
  addedBy: string;
  timestamp: number;
  fileName?: string;
  fileType?: string;
};

type EvidenceListProps = {
  items: EvidenceItem[];
  loading: boolean;
};

type VerificationState = {
  status: "success" | "error";
  message: string;
};

function shortValue(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export default function EvidenceList({ items, loading }: EvidenceListProps) {
  const gatewayBaseUrl =
    process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/+$/, "") ??
    "https://gateway.pinata.cloud/ipfs";
  const [verifyingCid, setVerifyingCid] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<
    Record<string, VerificationState>
  >({});

  const handleVerify = async (item: EvidenceItem, file: File | undefined) => {
    if (!file) return;

    setVerifyingCid(item.ipfsCID);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const computedHash = `0x${toHex(digest)}`.toLowerCase();
      const chainHash = item.fileHash.toLowerCase();
      const isValid = computedHash === chainHash;

      setVerificationResults((previous) => ({
        ...previous,
        [item.ipfsCID]: isValid
          ? {
              status: "success",
              message: "Integrity Verified: File is Authentic ✅",
            }
          : {
              status: "error",
              message: "Alert: File has been tampered with! ❌",
            },
      }));
    } finally {
      setVerifyingCid(null);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-lg shadow-zinc-950/30">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">Evidence Registry</h2>
        {loading ? (
          <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-r-transparent" />
            Loading...
          </span>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-zinc-400">
            <tr className="border-b border-zinc-800">
              <th className="py-2 pr-3">Case</th>
              <th className="py-2 pr-3">IPFS CID</th>
              <th className="py-2 pr-3">File Hash</th>
              <th className="py-2 pr-3">Media</th>
              <th className="py-2 pr-3">Added By</th>
              <th className="py-2 pr-3">Timestamp</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">View</th>
              <th className="py-2 pr-3">Integrity</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-zinc-500">
                  No evidence found on-chain yet.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const verification = verificationResults[item.ipfsCID];
                const inputId = `verify-file-${item.ipfsCID}`;
                const isVerifying = verifyingCid === item.ipfsCID;
                const fileUrl = `${gatewayBaseUrl}/${item.ipfsCID}`;
                const isImage = Boolean(item.fileType?.startsWith("image/"));

                return (
                  <tr key={item.ipfsCID} className="border-b border-zinc-800/80 text-zinc-200">
                    <td className="py-3 pr-3">{item.caseNumber}</td>
                    <td className="py-3 pr-3" title={item.ipfsCID}>
                      {shortValue(item.ipfsCID)}
                    </td>
                    <td className="py-3 pr-3" title={item.fileHash}>
                      {shortValue(item.fileHash)}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="max-w-[180px]">
                        <p className="truncate" title={item.fileName ?? "Unknown"}>
                          {item.fileName ?? "Unknown"}
                        </p>
                        <p className="truncate text-xs text-zinc-500" title={item.fileType ?? ""}>
                          {item.fileType ?? "Unknown type"}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 pr-3" title={item.addedBy}>
                      {shortValue(item.addedBy)}
                    </td>
                    <td className="py-3 pr-3">
                      {new Date(item.timestamp * 1000).toLocaleString()}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                        Verified
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        {isImage ? (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded border border-zinc-700 bg-zinc-900"
                            title="Preview image"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={fileUrl}
                              alt={item.fileName ?? "Evidence preview"}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ) : (
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-zinc-400"
                            title="No image preview"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </span>
                        )}
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          Open File
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex max-w-[240px] flex-col gap-2">
                        <label
                          htmlFor={inputId}
                          className="inline-flex cursor-pointer items-center justify-center rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          {isVerifying ? "Verifying..." : "Verify"}
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          className="hidden"
                          onChange={(event) =>
                            void handleVerify(item, event.target.files?.[0])
                          }
                        />
                        {verification ? (
                          <p
                            className={`text-xs ${
                              verification.status === "success"
                                ? "text-emerald-300"
                                : "text-red-400"
                            }`}
                          >
                            {verification.message}
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
