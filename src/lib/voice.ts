"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type VoiceMode = "auto" | "hi-IN" | "en-IN";

/** Stable no-op subscription for useSyncExternalStore (the value never changes). */
const NOOP_SUBSCRIBE = () => () => {};

export type VoiceState = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interim: string;
  activeLang: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  item: (index: number) => SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionErrorEventLike = { error: string; message?: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
  return candidate ?? null;
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "Microphone permission denied. Allow mic access in your browser and try again.",
  "service-not-allowed": "Your browser blocked the speech service. Try Chrome or Edge over HTTPS.",
  "no-speech": "No speech detected. Tap the mic and speak a little louder.",
  "audio-capture": "No microphone found on this device.",
  "language-not-supported": "This language is not supported by your browser's speech engine.",
  network: "Speech recognition needs a network connection.",
  aborted: "Listening stopped.",
};

/**
 * Web Speech API hook with Hindi + English support.
 * `auto` starts in hi-IN and retries once in en-IN if nothing was recognised,
 * which is the closest thing to real language detection the API offers.
 */
export function useVoiceInput(mode: VoiceMode, onFinal?: (text: string) => void): VoiceState {
  // Browser-only capability read via useSyncExternalStore: SSR snapshot is false,
  // the client snapshot reflects the real Web Speech API without a hydration clash.
  const supported = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => Boolean(getRecognitionCtor()),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [activeLang, setActiveLang] = useState(mode === "en-IN" ? "en-IN" : "hi-IN");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const heardSomethingRef = useRef(false);
  const retryingRef = useRef(false);
  const manualStopRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  /** Lets the recognition `onend` callback re-enter `run` for the English retry. */
  const runRef = useRef<(lang: string) => void>(() => {});
  // Kept fresh in an effect (never during render) so the compiler rules stay happy.

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const run = useCallback(
    (lang: string) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setError("Voice input is not supported in this browser - use Chrome, Edge or Safari.");
        return;
      }

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      setActiveLang(lang);

      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) finalText += text;
          else interimText += text;
        }
        if (interimText) {
          heardSomethingRef.current = true;
          setInterim(interimText);
        }
        if (finalText.trim()) {
          heardSomethingRef.current = true;
          setInterim("");
          setTranscript((current) => `${current} ${finalText}`.trim());
          onFinalRef.current?.(finalText.trim());
        }
      };

      recognition.onerror = (event) => {
        const message = ERROR_TEXT[event.error] ?? `Speech recognition error: ${event.error}`;
        setError(message);
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
        setInterim("");
        recognitionRef.current = null;

        // Auto mode: nothing understood in Hindi -> retry once in English.
        if (
          mode === "auto" &&
          !manualStopRef.current &&
          !heardSomethingRef.current &&
          !retryingRef.current &&
          lang === "hi-IN"
        ) {
          retryingRef.current = true;
          window.setTimeout(() => runRef.current("en-IN"), 220);
        } else {
          retryingRef.current = false;
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setListening(true);
        setError(null);
      } catch (startError) {
        console.error("[VOICE] start failed:", startError);
        setError("Could not start the microphone session. Tap the mic again.");
        setListening(false);
      }
    },
    [mode],
  );

  useEffect(() => {
    runRef.current = run;
    onFinalRef.current = onFinal;
  }, [run, onFinal]);

  const start = useCallback(() => {
    manualStopRef.current = false;
    heardSomethingRef.current = false;
    retryingRef.current = false;
    setTranscript("");
    const lang = mode === "auto" ? "hi-IN" : mode;
    run(lang);
  }, [mode, run]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  return { supported, listening, transcript, interim, activeLang, error, start, stop, reset };
}
