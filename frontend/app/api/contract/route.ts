import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const artifactPath = path.join(
      process.cwd(),
      "..",
      "artifacts",
      "contracts",
      "LexChain.sol",
      "LexChain.json"
    );
    const artifactRaw = await fs.readFile(artifactPath, "utf8");
    const artifact = JSON.parse(artifactRaw);

    return NextResponse.json({ abi: artifact.abi });
  } catch {
    return NextResponse.json(
      { error: "Unable to load contract ABI from artifacts." },
      { status: 500 }
    );
  }
}
