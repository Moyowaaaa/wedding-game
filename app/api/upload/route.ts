import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

// Node runtime so the cloudinary SDK (crypto) works reliably.
export const runtime = "nodejs";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

/**
 * Returns a signed Cloudinary upload signature so the browser can upload
 * directly to Cloudinary and bypass the Vercel serverless body size limit
 * (~4.5MB). The file never touches our server.
 */
export async function GET() {
  try {
    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        { error: "Cloudinary env vars are not configured" },
        { status: 500 },
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = "wedding-photos";

    // IMPORTANT: every param sent to Cloudinary (except file, api_key,
    // resource_type, cloud_name, signature) must be included in the signature.
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      API_SECRET,
    );

    return NextResponse.json({
      signature,
      timestamp,
      folder,
      apiKey: API_KEY,
      cloudName: CLOUD_NAME,
    });
  } catch (error: any) {
    console.error("Signature error:", error);
    return NextResponse.json(
      { error: "Failed to create upload signature", detail: error?.message },
      { status: 500 },
    );
  }
}
