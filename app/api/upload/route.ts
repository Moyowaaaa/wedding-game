import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

// Node runtime (not Edge) so cloudinary + Buffer work.
export const runtime = "nodejs";
// Give large video uploads room to finish (Vercel serverless default is 10s).
export const maxDuration = 60;

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const isVideo = file.type.startsWith("video/");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: isVideo ? "video" : "image",
          folder: "wedding-photos",
          // `quality: auto` is image-only; don't send for video.
          ...(isVideo ? {} : { quality: "auto" }),
          // Larger chunks reduce overhead for phone videos.
          chunk_size: 6_000_000,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );

      uploadStream.end(buffer);
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: "Upload failed",
        // Surface the underlying reason so the client and server logs are useful.
        detail:
          error?.message ||
          error?.error?.message ||
          (typeof error === "string" ? error : "Unknown error"),
      },
      { status: 500 },
    );
  }
}
