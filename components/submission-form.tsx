"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PHOTO_CHALLENGES } from "./photo-checklist";
import { Loader2 } from "lucide-react";

type UploadStage = "idle" | "uploading" | "saving" | "done";

function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid server response"));
        }
      } else {
        let detail = "";
        try {
          const body = JSON.parse(xhr.responseText);
          detail = body?.detail || body?.error || "";
        } catch {}
        reject(
          new Error(
            `Upload failed (${xhr.status})${detail ? `: ${detail}` : ""}`,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
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
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isSubmitting = stage === "uploading" || stage === "saving";

  const challengeData = PHOTO_CHALLENGES.find((c) => c.id === challenge);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!guestName.trim()) {
      setError("Please enter your name");
      return;
    }

    setError(null);
    setProgress(0);
    setStage("uploading");

    try {
      // 1. Upload photo to Cloudinary with real progress
      const uploadFormData = new FormData();
      uploadFormData.append("file", photoFile);

      const uploadedData = await uploadWithProgress(
        "/api/upload",
        uploadFormData,
        (pct) => setProgress(pct),
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
          guestName,
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
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              disabled={isSubmitting}
              className="bg-secondary border-border"
              required
            />
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
              disabled={isSubmitting || !guestName.trim()}
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
