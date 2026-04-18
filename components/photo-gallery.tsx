"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  supabase,
  SUBMISSIONS_TABLE,
  type Submission as DbSubmission,
} from "@/lib/supabase";

interface Submission {
  id: string;
  guestName: string;
  challenge: string;
  caption: string;
  imageUrl: string;
  timestamp: string;
}

function fromDb(row: DbSubmission): Submission {
  return {
    id: row.id,
    guestName: row.guest_name,
    challenge: row.challenge,
    caption: row.caption ?? "",
    imageUrl: row.image_url,
    timestamp: row.created_at,
  };
}

export function PhotoGallery() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 1. Initial load
    (async () => {
      const { data, error } = await supabase
        .from(SUBMISSIONS_TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch submissions:", error);
      } else if (data) {
        setSubmissions(data.map(fromDb));
      }
      setLoading(false);
    })();

    // 2. Realtime subscription for new inserts
    const channel = supabase
      .channel("submissions-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: SUBMISSIONS_TABLE },
        (payload) => {
          const row = payload.new as DbSubmission;
          setSubmissions((prev) => {
            if (prev.some((s) => s.id === row.id)) return prev;
            return [fromDb(row), ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading photos...</p>
        </div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-lg font-serif text-muted-foreground mb-2">
            No photos yet
          </p>
          <p className="text-sm text-muted-foreground">
            Check back as guests start uploading their photos!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold text-foreground mb-2">
          Guest Photos
        </h2>
        <p className="text-muted-foreground">
          {submissions.length} photos uploaded
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {submissions.map((submission) => (
          <Card
            key={submission.id}
            className="overflow-hidden hover:shadow-lg transition-shadow"
          >
            <CardContent className="p-0">
              <div className="relative aspect-square bg-secondary overflow-hidden">
                <Image
                  src={submission.imageUrl}
                  alt={submission.challenge}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            </CardContent>
            <CardHeader className="pb-3">
              <div className="space-y-2">
                <div className="inline-block bg-accent/10 text-accent px-2 py-1 rounded text-xs font-medium">
                  {submission.challenge}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {submission.guestName}
                  </p>
                  {submission.caption && (
                    <p className="text-muted-foreground text-sm mt-1 italic">
                      "{submission.caption}"
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  {new Date(submission.timestamp).toLocaleString()}
                </p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
