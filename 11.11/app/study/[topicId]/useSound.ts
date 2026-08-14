"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioField = "question-lu" | "question-ru" | "answer-lu" | "answer-ru";

const SOUND_STORAGE_KEY = "flashcards-sound-on";

export function useSound() {
  const [soundOn, setSoundOnState] = useState(true);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingRejectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setSoundOnState(stored === "true");
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
        audio!.removeEventListener("error", onError);
        pendingRejectRef.current = null;
      }
      function onEnded() {
        cleanup();
        resolve();
      }
      function onError() {
        cleanup();
        setAudioError(true);
        reject(new Error("audio playback failed"));
      }
      function onStopped() {
        cleanup();
        reject(new Error("stopped"));
      }
      pendingRejectRef.current = onStopped;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      setAudioError(false);
      audio.src = `/api/tts/${cardId}/${field}`;
      audio.play().catch(onError);
    });
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    pendingRejectRef.current?.();
  }, []);

  return { soundOn, setSoundOn, audioError, play, stop };
}
