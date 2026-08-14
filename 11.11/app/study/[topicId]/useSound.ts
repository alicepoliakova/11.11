"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioField = "question-lu" | "question-ru" | "answer-lu" | "answer-ru";

const SOUND_STORAGE_KEY = "flashcards-sound-on";

export function useSound() {
  const [soundOn, setSoundOnState] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingRejectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setSoundOnState(stored === "true");
    setHydrated(true);
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const setSoundOn = useCallback((value: boolean) => {
    setSoundOnState(value);
    window.localStorage.setItem(SOUND_STORAGE_KEY, String(value));
  }, []);

  const play = useCallback((cardId: number, field: AudioField): Promise<void> => {
    const audio = audioRef.current;
    if (!audio) return Promise.reject(new Error("audio not ready"));

    return new Promise<void>((resolve, reject) => {
      function cleanup() {
        audio!.removeEventListener("ended", onEnded);
        audio!.removeEventListener("error", onDomError);
        if (pendingRejectRef.current === onStopped) {
          pendingRejectRef.current = null;
        }
      }
      function onEnded() {
        cleanup();
        resolve();
      }
      // A genuine media failure (bad/missing source, decode error, etc.)
      // reported by the <audio> element's `error` event — always a real
      // failure, so it always sets audioError.
      function onDomError() {
        cleanup();
        setAudioError(true);
        reject(new Error("audio playback failed"));
      }
      // `audio.play()`'s rejection can also be a benign, expected
      // occurrence rather than a real failure: NotAllowedError (browser
      // blocked autoplay pending a user gesture — the next user
      // interaction naturally retries) or AbortError (this play() was
      // superseded by a newer one before it finished loading/starting).
      // Only surface "Audio unavailable" for anything else.
      function onPlayRejected(err: unknown) {
        cleanup();
        const isBenign =
          err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError");
        if (!isBenign) {
          setAudioError(true);
        }
        reject(err instanceof Error ? err : new Error("audio playback failed"));
      }
      function onStopped() {
        cleanup();
        reject(new Error("stopped"));
      }
      pendingRejectRef.current = onStopped;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onDomError);
      setAudioError(false);
      audio.src = `/api/tts/${cardId}/${field}`;
      audio.play().catch(onPlayRejected);
    });
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    pendingRejectRef.current?.();
  }, []);

  return { soundOn, setSoundOn, audioError, play, stop, hydrated };
}
