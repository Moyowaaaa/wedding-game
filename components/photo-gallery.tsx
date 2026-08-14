"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Maximize2,
  X,
} from "lucide-react";
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

/**
 * Custom video hero: autoplays muted, exposes play/pause + mute/unmute +
 * scrub bar. Calls onEnded when the video finishes so the slideshow can
 * advance.
 */
function VideoHero({ src, onEnded }: { src: string; onEnded: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = parseFloat(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="group absolute inset-0">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={onEnded}
        onClick={togglePlay}
        className="absolute inset-0 w-full h-full object-cover bg-black animate-in fade-in duration-500 cursor-pointer peer"
      />

      {/* Custom controls bar */}
      <div className="absolute inset-x-0 top-0 p-3 flex items-center gap-2 pointer-events-none">
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause video" : "Play video"}
          className="pointer-events-auto p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white transition-all shadow-lg shadow-black/20"
        >
          {playing ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 fill-white" />
          )}
        </button>
        <button
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="pointer-events-auto p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white transition-all shadow-lg shadow-black/20"
        >
          {muted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        {muted && (
          <span className="pointer-events-none px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[11px] font-medium shadow-lg shadow-black/20">
            Tap to unmute
          </span>
        )}
      </div>

      {/* Scrub bar */}
      <div className="absolute inset-x-0 bottom-0 pb-24 sm:pb-32 px-4 sm:px-6 pointer-events-none">
        <div className="pointer-events-auto p-3 rounded-full max-w-[calc(100%-2rem)] mx-auto opacity-0 transition-all duration-200 group-hover:opacity-100 peer-hover:opacity-100 group-hover:bg-black/40 group-hover:backdrop-blur-sm group-hover:shadow-lg group-hover:shadow-black/20 peer-hover:bg-black/40 peer-hover:backdrop-blur-sm peer-hover:shadow-lg peer-hover:shadow-black/20">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={currentTime}
            onChange={handleScrub}
            aria-label="Seek"
            className="w-full h-1 appearance-none bg-white/30 rounded-full outline-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #f09a36 ${pct}%, rgba(255,255,255,0.3) ${pct}%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function PhotoGallery() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
    const el = thumbRefs.current?.[activeIndex];
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
          <p className="text-muted-foreground">Loading media ...</p>
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
    <>
      <div className="flex flex-col h-svh sm:h-auto sm:space-y-6">
        <div className="hidden sm:block text-center mb-2">
          <h2 className="text-3xl font-serif font-bold text-foreground mb-2">
            Guest Media
          </h2>
          <p className="text-muted-foreground">
            {submissions.length} photo{submissions.length === 1 ? "" : "s"}
            /video
            {submissions.length === 1 ? "" : "s"} uploaded
          </p>
        </div>

        {/* Hero media */}
        <div className="relative w-full flex-1 min-h-0 sm:flex-none sm:aspect-[16/10] sm:rounded-2xl overflow-hidden bg-secondary sm:shadow-xl">
          {active.mediaType === "video" ? (
            <VideoHero
              key={active.id}
              src={active.imageUrl}
              onEnded={() => {
                if (isPlaying) next();
              }}
            />
          ) : (
            <Image
              key={active.id}
              src={active.imageUrl}
              alt={active.challenge}
              fill
              priority
              loading="eager"
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
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(active.timestamp))}{" "}
              at{" "}
              {new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(active.timestamp))}
            </p>
          </div>

          {/* Controls overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Prev / next */}
            {submissions.length > 1 && (
              <>
                <button
                  onClick={prev}
                  aria-label="Previous photo"
                  className="pointer-events-auto absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white transition-all shadow-lg shadow-black/20"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={next}
                  aria-label="Next photo"
                  className="pointer-events-auto absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white transition-all shadow-lg shadow-black/20"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(true)}
              aria-label="Fullscreen"
              className="pointer-events-auto absolute top-3 right-3 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white transition-all shadow-lg shadow-black/20"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
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
                {s.mediaType === "video" ? (
                  <video
                    src={s.imageUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <Image
                    src={s.imageUrl}
                    alt={s.challenge}
                    fill
                    sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw"
                    className="object-cover"
                  />
                )}
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

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setIsFullscreen(false)}
            aria-label="Exit fullscreen"
            className="absolute
            z-[9999999]
            top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative w-full h-full max-w-full max-h-screen ">
            {active.mediaType === "video" ? (
              <VideoHero
                key={active.id}
                src={active.imageUrl}
                onEnded={() => {
                  if (isPlaying) next();
                }}
              />
            ) : (
              <Image
                key={active.id}
                src={active.imageUrl}
                alt={active.challenge}
                fill
                sizes="100vw"
                className="object-cover"
              />
            )}

            {/* Fullscreen metadata overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white">
              <div className="inline-block bg-accent text-accent-foreground px-3 py-1 rounded text-sm font-medium mb-2">
                {active.challenge}
              </div>
              <p className="font-serif text-xl sm:text-2xl font-semibold">
                {active.guestName}
              </p>
              {active.caption && (
                <p className="text-base sm:text-lg italic text-white/90 mt-1">
                  "{active.caption}"
                </p>
              )}
              <p className="text-sm text-white/70 mt-2">
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(active.timestamp))}{" "}
                at{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(active.timestamp))}
              </p>
            </div>

            {/* Fullscreen controls */}
            <div className="absolute inset-0 pointer-events-none">
              {submissions.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    aria-label="Previous photo"
                    className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white transition-all shadow-lg shadow-black/30"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={next}
                    aria-label="Next photo"
                    className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white transition-all shadow-lg shadow-black/30"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
