"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PHOTO_CHALLENGES } from "./photo-checklist";
import { Loader2, Pencil } from "lucide-react";

const GUEST_NAME_KEY = "wedding-guest-name";

type UploadStage = "idle" | "uploading" | "saving" | "done";

// ~6MB chunks: large enough to keep per-chunk overhead low, small enough
// that a flaky mobile connection can retry one without losing much progress.
const CHUNK_SIZE = 6 * 1024 * 1024;
const MAX_RETRIES_PER_CHUNK = 4;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * POSTs a single chunk (or a whole small file) to Cloudinary with XHR so we
 * get real upload progress. Used by both single-shot and chunked paths.
 */
function xhrUpload(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  onChunkProgress: (loaded: number, total: number) => void,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onChunkProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      let body: any = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        // non-JSON response (e.g. intermediate 200 with empty body is fine)
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(formData);
  });
}

/**
 * Uploads a file directly to Cloudinary in chunks, with per-chunk retries.
 * Each chunk uses the same signed params and a shared X-Unique-Upload-Id so
 * Cloudinary stitches them back together. Only the final chunk returns the
 * full upload result (secure_url, public_id, etc.).
 *
 * Bypasses Vercel's ~4.5MB serverless body limit because the file never
 * touches our server.
 */
async function uploadDirectToCloudinary(
  file: File,
  onProgress: (pct: number) => void,
): Promise<any> {
  // 1. Get a short-lived upload signature from our backend.
  const sigRes = await fetch("/api/upload");
  if (!sigRes.ok) {
    const body = await sigRes.json().catch(() => ({}));
    throw new Error(
      body?.detail || body?.error || "Failed to get upload signature",
    );
  }
  const { signature, timestamp, folder, apiKey, cloudName } =
    await sigRes.json();

  const resourceType = file.type.startsWith("video/") ? "video" : "image";
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  const total = file.size;
  const uniqueId =
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  let uploadedBeforeThisChunk = 0;
  let finalResult: any = null;

  // Small files: one request, no Content-Range needed.
  const useChunked = total > CHUNK_SIZE;

  const sendChunk = async (start: number, end: number): Promise<any> => {
    const chunk = file.slice(start, end);
    const formData = new FormData();
    formData.append("file", chunk);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", folder);

    const headers: Record<string, string> = {};
    if (useChunked) {
      headers["X-Unique-Upload-Id"] = uniqueId;
      // Cloudinary expects "bytes start-end/total" (end is inclusive).
      headers["Content-Range"] = `bytes ${start}-${end - 1}/${total}`;
    }

    let lastErr: any = null;
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_CHUNK; attempt++) {
      try {
        const { status, body } = await xhrUpload(
          uploadUrl,
          formData,
          headers,
          (loaded) => {
            const overall = Math.min(
              total,
              uploadedBeforeThisChunk + loaded,
            );
            onProgress(Math.round((overall / total) * 100));
          },
        );

        // 200 = final chunk accepted (or single-shot upload).
        // 201 = intermediate chunk accepted, more expected.
        if (status === 200 || status === 201) {
          return body;
        }

        // 4xx from Cloudinary = permanent, don't retry.
        if (status >= 400 && status < 500) {
          const detail =
            body?.error?.message || body?.error || `HTTP ${status}`;
          throw new Error(`Upload rejected: ${detail}`);
        }

        // 5xx = transient, fall through to retry.
        lastErr = new Error(
          body?.error?.message || body?.error || `Upload failed (${status})`,
        );
      } catch (err) {
        lastErr = err;
      }

      if (attempt < MAX_RETRIES_PER_CHUNK) {
        // Exponential backoff: 500ms, 1s, 2s, 4s.
        await sleep(500 * Math.pow(2, attempt));
      }
    }
    throw lastErr || new Error("Upload failed after retries");
  };

  if (!useChunked) {
    finalResult = await sendChunk(0, total);
  } else {
    for (let start = 0; start < total; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, total);
      const body = await sendChunk(start, end);
      uploadedBeforeThisChunk = end;
      onProgress(Math.round((end / total) * 100));
      if (end === total) finalResult = body;
    }
  }

  if (!finalResult || !finalResult.secure_url) {
    throw new Error("Upload completed but no secure_url returned");
  }
  return finalResult;
}

interface SubmissionFormProps {
  challenge: number;
  photoFile: File;
  onComplete: () => void;
  onBack: () => void;
}

export function SubmissionForm({
  challenge,
  photoFile,
  onComplete,
  onBack,
}: SubmissionFormProps) {
  const [guestName, setGuestName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nameReady, setNameReady] = useState(false);

  const isSubmitting = stage === "uploading" || stage === "saving";

  const challengeData = PHOTO_CHALLENGES.find((c) => c.id === challenge);

  useEffect(() => {
    const saved = localStorage.getItem(GUEST_NAME_KEY)?.trim() ?? "";
    setGuestName(saved);
    setNameDraft(saved);
    setIsEditingName(!saved);
    setNameReady(true);
  }, []);

  const saveGuestName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    localStorage.setItem(GUEST_NAME_KEY, trimmed);
    setGuestName(trimmed);
    setNameDraft(trimmed);
    setIsEditingName(false);
    return true;
  };

  const handleSaveName = () => {
    if (!saveGuestName(nameDraft)) {
      setError("Please enter your name");
      return;
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // If still editing, commit the draft first.
    const nameToUse = isEditingName ? nameDraft.trim() : guestName.trim();
    if (!nameToUse) {
      setError("Please enter your name");
      setIsEditingName(true);
      return;
    }
    saveGuestName(nameToUse);

    setError(null);
    setProgress(0);
    setStage("uploading");

    try {
      // 1. Upload photo/video directly to Cloudinary with real progress.
      //    Direct upload bypasses Vercel's ~4.5MB serverless body limit.
      const uploadedData = await uploadDirectToCloudinary(photoFile, (pct) =>
        setProgress(pct),
      );
      const imageUrl = uploadedData.secure_url;
      if (!imageUrl)
        throw new Error("Upload succeeded but no image URL returned");

      // 2. Save submission metadata (quick, indeterminate)
      setStage("saving");
      setProgress(100);

      const submissionResponse = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: nameToUse,
          challenge: challengeData?.title || "",
          caption,
          imageUrl,
          mediaType: photoFile.type.startsWith("video/") ? "video" : "image",
        }),
      });

      if (!submissionResponse.ok) {
        throw new Error("Failed to save submission");
      }

      setStage("done");
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStage("idle");
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-accent hover:underline text-sm font-medium"
      >
        ← Retake Photo
      </button>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-serif font-semibold text-primary mb-2">
            {challengeData?.emoji} {challengeData?.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete your submission by adding your details below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground"
            >
              Your Name *
            </label>
            {!nameReady ? (
              <div className="h-10 rounded-md bg-secondary/60 animate-pulse" />
            ) : isEditingName ? (
              <div className="flex gap-2">
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  disabled={isSubmitting}
                  className="bg-secondary border-border"
                  autoFocus
                  required
                />
                <Button
                  type="button"
                  onClick={handleSaveName}
                  disabled={isSubmitting || !nameDraft.trim()}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
                >
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-md bg-secondary border border-border px-3 py-2">
                <p className="text-sm text-foreground truncate">
                  Submitting as{" "}
                  <span className="font-medium">{guestName}</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNameDraft(guestName);
                    setIsEditingName(true);
                  }}
                  disabled={isSubmitting}
                  className="shrink-0 text-accent hover:text-accent"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="caption"
              className="block text-sm font-medium text-foreground"
            >
              Add a Caption (Optional)
            </label>
            <textarea
              id="caption"
              placeholder="Share a moment or memory..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {caption.length}/200 characters
            </p>
          </div>

          {isSubmitting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {stage === "uploading"
                    ? `Uploading… ${progress}%`
                    : "Saving submission…"}
                </span>
                {stage === "saving" && (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                )}
              </div>
              <Progress value={stage === "saving" ? 100 : progress} />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                (!guestName.trim() && !nameDraft.trim())
              }
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Submit Photo"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
