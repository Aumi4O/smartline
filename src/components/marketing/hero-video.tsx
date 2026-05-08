"use client";

import { useRef, useState } from "react";

const ACCENT = "#0066FF";

/**
 * Hero showreel.
 *
 * The video is 9:16 (1080×1920) so we render it as a phone-sized mockup
 * centered in the hero. Autoplay-with-sound is blocked by every modern
 * browser — we autoplay muted, then a single tap on the speaker pill
 * unmutes and (if needed) restarts playback.
 */
export function HeroVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggleSound() {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    if (!next) {
      // Browsers unmute mid-play just fine, but if the user paused via OS
      // controls or a mobile lock-screen we make sure playback resumes.
      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Autoplay-after-gesture should never reject, but be defensive.
        });
      }
    }
    setMuted(next);
  }

  return (
    <div className="mx-auto mt-12 max-w-[340px] sm:max-w-[360px]">
      <div
        className="relative overflow-hidden rounded-[36px] border border-gray-200 bg-black shadow-[0_30px_80px_-30px_rgba(0,102,255,0.35)]"
        style={{ aspectRatio: "9 / 16" }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="SmartLine AI phone agent in action"
        />

        {/* Sound toggle */}
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? "Unmute video" : "Mute video"}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition hover:bg-black/75"
          style={{
            boxShadow: muted
              ? `0 0 0 2px rgba(0,102,255,0.55)`
              : "0 0 0 1px rgba(255,255,255,0.2)",
          }}
        >
          {muted ? (
            <>
              <SpeakerOff className="h-3.5 w-3.5" />
              <span>Tap for sound</span>
            </>
          ) : (
            <>
              <SpeakerOn className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              <span>Sound on</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SpeakerOff({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function SpeakerOn({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}
