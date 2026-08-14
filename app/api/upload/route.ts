import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

function getS3() {
  if (!REGION || !BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error(
      "S3 is not configured. Set AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
    );
  }

  return {
    bucket: BUCKET,
    region: REGION,
    client: new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
      },
      // Prevent the SDK from adding checksum headers/params that the
      // browser PUT can't reproduce (would cause SignatureDoesNotMatch / 403).
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
}

function extensionFor(contentType: string, filename: string) {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;

  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return map[contentType] || "bin";
}

/**
 * Returns a short-lived presigned PUT URL so the browser can upload
 * directly to S3 (bypasses Vercel body size limits).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const contentType =
      typeof body.contentType === "string" ? body.contentType.trim() : "";
    const filename =
      typeof body.filename === "string" ? body.filename.trim() : "upload";

    if (!contentType) {
      return NextResponse.json(
        { error: "contentType is required" },
        { status: 400 },
      );
    }

    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return NextResponse.json(
        { error: "Only image and video uploads are allowed" },
        { status: 400 },
      );
    }

    const { client, bucket, region } = getS3();
    const ext = extensionFor(contentType, filename);
    const key = `wedding-photos/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (error: any) {
    console.error("Presign error:", error);
    return NextResponse.json(
      {
        error: "Failed to create upload URL",
        detail: error?.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}
