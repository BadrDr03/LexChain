"use client";

import { FormEvent, useState } from "react";

type EvidenceFormProps = {
  onSubmitEvidence: (payload: {
    caseNumber: string;
    ipfsCID: string;
    fileHash: string;
    fileName: string;
    fileType: string;
  }) => Promise<void>;
  txPending: boolean;
  connected: boolean;
};

export default function EvidenceForm({
  onSubmitEvidence,
  txPending,
  connected,
}: EvidenceFormProps) {
  const [caseNumber, setCaseNumber] = useState("");
  const [ipfsCID, setIpfsCID] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");

  const handleFileChange = async (file: File | undefined) => {
    if (!file) {
      setIsHashing(false);
      setFileHash("");
      setIpfsCID("");
      setFileName("");
      setFileType("");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setIsHashing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hash = `0x${toHex(digest)}`;

      setFileHash(hash);
      setIpfsCID("");
      setFileName(file.name);
      setFileType(file.type || "application/octet-stream");
    } finally {
      setIsHashing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", selectedFile, selectedFile.name);

      const uploadResponse = await fetch("/api/pinata-upload", {
        method: "POST",
        body: uploadFormData,
      });
      const uploadResult = (await uploadResponse.json()) as {
        cid?: string;
        error?: string;
      };

      if (!uploadResponse.ok || !uploadResult.cid) {
        throw new Error(uploadResult.error ?? "Failed to upload file to Pinata.");
      }

      setIpfsCID(uploadResult.cid);
      await onSubmitEvidence({
        caseNumber,
        ipfsCID: uploadResult.cid,
        fileHash,
        fileName,
        fileType,
      });
      setCaseNumber("");
      setIpfsCID("");
      setFileHash("");
      setFileName("");
      setFileType("");
      setSelectedFile(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload evidence to Pinata.";
      alert(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-lg shadow-zinc-950/30">
      <h2 className="text-xl font-semibold text-zinc-100">Submit Evidence</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Add case metadata to LexChain (POLICE_ROLE required).
      </p>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm text-zinc-300">Case Number</span>
          <input
            required
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
            placeholder="CASE-2026-001"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-zinc-300">Upload Media (Image, Video, Audio)</span>
          <input
            required
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={(e) => void handleFileChange(e.target.files?.[0])}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-zinc-300">File Hash</span>
          <input
            required
            value={fileHash}
            readOnly
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
            placeholder={isHashing ? "Calculating SHA-256..." : "Auto-generated SHA-256 hash"}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-zinc-300">IPFS CID (from Pinata upload)</span>
          <input
            required
            value={ipfsCID}
            readOnly
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
            placeholder="Will be filled after upload"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-zinc-300">File Name (IPFS placeholder metadata)</span>
          <input
            value={fileName}
            readOnly
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
            placeholder="Captured from selected file"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-zinc-300">File Type (IPFS placeholder metadata)</span>
          <input
            value={fileType}
            readOnly
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-emerald-400/40 focus:ring"
            placeholder="Captured MIME type"
          />
        </label>

        <button
          type="submit"
          disabled={!connected || txPending || isHashing || isUploading || !fileHash || !selectedFile}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2 font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
        >
          {txPending || isHashing || isUploading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-r-transparent" />
              {isHashing
                ? "Hashing file..."
                : isUploading
                  ? "Uploading to IPFS..."
                  : "Loading..."}
            </>
          ) : (
            "Submit to Blockchain"
          )}
        </button>
      </form>
    </section>
  );
}
