import { NextResponse } from "next/server";

const PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function POST(request: Request) {
  try {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return NextResponse.json(
        { error: "Missing PINATA_JWT on server." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    const pinataFormData = new FormData();
    pinataFormData.append("file", file, file.name);

    const response = await fetch(PINATA_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: pinataFormData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Pinata upload failed: ${errorBody}` },
        { status: 500 }
      );
    }

    const result = (await response.json()) as { IpfsHash?: string };
    if (!result.IpfsHash) {
      return NextResponse.json(
        { error: "Pinata response did not contain IpfsHash." },
        { status: 500 }
      );
    }

    return NextResponse.json({ cid: result.IpfsHash });
  } catch {
    return NextResponse.json(
      { error: "Unexpected upload error while talking to Pinata." },
      { status: 500 }
    );
  }
}
