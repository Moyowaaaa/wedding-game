"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import {
  supabase,
  SUBMISSIONS_TABLE,
  type Submission as DbSubmission,
  type MediaType,
} from "@/lib/supabase";

const AUTOPLAY_MS = 4500;

interface Submission {
  id: string;
  guestName: string;
  challenge: string;
  caption: string;
  imageUrl: string;
  mediaType: MediaType;
  timestamp: string;
}

function fromDb(row: DbSubmission): Submission {
  return {
    id: row.id,
    guestName: row.guest_name,
    challenge: row.challenge,
    caption: row.caption ?? "",
    imageUrl: row.image_url,
    mediaType: row.media_type ?? "image",
    timestamp: row.created_at,
  };
}

/** Convert a Cloudinary video URL to a jpg poster frame. */
function videoPoster(url: string): string {
  return url.replace(/\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i, ".jpg$2");
}

export function PhotoGallery() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  // Clamp active index when the list shrinks; keep position when items prepend.
  useEffect(() => {
    if (submissions.length === 0) return;
    if (activeIndex >= submissions.length) setActiveIndex(0);
  }, [submissions.length, activeIndex]);

  const goTo = useCallback(
    (index: number) => {
      if (submissions.length === 0) return;
      const next =
        ((index % submissions.length) + submissions.length) %
        submissions.length;
      setActiveIndex(next);
    },
    [submissions.length],
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  // Autoplay — pauses the timer when the active item is a video
  // (video advances on its `ended` event instead).
  useEffect(() => {
    if (!isPlaying || submissions.length <= 1) return;
    const active = submissions[activeIndex];
    if (active?.mediaType === "video") return;
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % submissions.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [isPlaying, submissions, activeIndex]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Keep active thumbnail in view
  useEffect(() => {
    const el = thumbRefs.current[activeIndex];
    el?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeIndex]);

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

  const active = submissions[activeIndex];

  return (
    <div className="flex flex-col h-svh sm:h-auto sm:space-y-6">
      <div className="hidden sm:block text-center mb-2">
        <h2 className="text-3xl font-serif font-bold text-foreground mb-2">
          Guest Photos
        </h2>
        <p className="text-muted-foreground">
          {submissions.length} photo{submissions.length === 1 ? "" : "s"}{" "}
          uploaded
        </p>
      </div>

      {/* Hero media */}
      <div className="relative w-full flex-1 min-h-0 sm:flex-none sm:aspect-[16/10] sm:rounded-2xl overflow-hidden bg-secondary sm:shadow-xl">
        {active.mediaType === "video" ? (
          <video
            key={active.id}
            src={active.imageUrl}
            autoPlay
            muted
            playsInline
            controls
            onEnded={() => {
              if (isPlaying) next();
            }}
            className="absolute inset-0 w-full h-full object-cover bg-black animate-in fade-in duration-500"
          />
        ) : (
          <Image
            key={active.id}
            src={active.imageUrl}
            alt={active.challenge}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover animate-in fade-in duration-500"
          />
        )}

        {/* Gradient + caption overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 sm:p-6 text-white">
          <div className="inline-block bg-accent text-accent-foreground px-2 py-1 rounded text-xs font-medium mb-2">
            {active.challenge}
          </div>
          <p className="font-serif text-lg sm:text-xl font-semibold">
            {active.guestName}
          </p>
          {active.caption && (
            <p className="text-sm sm:text-base italic text-white/90 mt-1">
              “{active.caption}”
            </p>
          )}
          <p className="text-xs text-white/70 mt-2">
            {new Date(active.timestamp).toLocaleString()}
          </p>
        </div>

        {/* Prev / next */}
        {submissions.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next photo"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Play/pause + counter */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="px-2 py-1 rounded-full bg-black/40 text-white text-xs font-medium">
            {activeIndex + 1} / {submissions.length}
          </span>
          {submissions.length > 1 && (
            <button
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Thumbnail strip: horizontal scroll on mobile, grid on desktop */}
      <div className="flex sm:grid sm:grid-cols-6 md:grid-cols-8 gap-2 overflow-x-auto sm:overflow-visible px-2 pt-2 pb-[env(safe-area-inset-bottom)] sm:p-0 bg-background/80 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none snap-x snap-mandatory sm:snap-none">
        {submissions.map((s, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={s.id}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              onClick={() => {
                setIsPlaying(false);
                setActiveIndex(i);
              }}
              aria-label={`View photo ${i + 1} by ${s.guestName}`}
              className={`relative shrink-0 sm:shrink w-20 sm:w-auto aspect-square rounded-lg overflow-hidden bg-secondary transition-all snap-start ${
                isActive
                  ? "ring-2 ring-accent ring-offset-2 ring-offset-background scale-[1.02]"
                  : "opacity-70 hover:opacity-100 hover:scale-[1.02]"
              }`}
            >
              <Image
                src={
                  s.mediaType === "video" ? videoPoster(s.imageUrl) : s.imageUrl
                }
                alt={s.challenge}
                fill
                sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw"
                className="object-cover"
              />
              {s.mediaType === "video" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
