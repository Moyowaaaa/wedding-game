"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getChallengeById } from "./photo-checklist";
import { Loader2, Pencil } from "lucide-react";

const GUEST_NAME_KEY = "wedding-guest-name";

type UploadStage = "idle" | "uploading" | "saving" | "done";

/**
 * PUT a file to an S3 presigned URL with upload progress.
 */
function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });
}

async function uploadDirectToS3(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const sigRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType: file.type || "application/octet-stream",
      filename: file.name || "upload",
    }),
  });

  if (!sigRes.ok) {
    const body = await sigRes.json().catch(() => ({}));
    throw new Error(
      body?.detail || body?.error || "Failed to get upload URL",
    );
  }

  const { uploadUrl, publicUrl } = await sigRes.json();
  if (!uploadUrl || !publicUrl) {
    throw new Error("Upload URL missing from server response");
  }

  await uploadToPresignedUrl(uploadUrl, file, onProgress);
  return publicUrl as string;
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

  const challengeData = getChallengeById(challenge);

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
      const imageUrl = await uploadDirectToS3(photoFile, (pct) =>
        setProgress(pct),
      );
      if (!imageUrl) throw new Error("Upload succeeded but no URL returned");

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
                isSubmitting || (!guestName.trim() && !nameDraft.trim())
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
