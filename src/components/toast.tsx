"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "@/components/icons";

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; title: string; description?: string };

type ToastContextValue = {
  toast: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastKind, { ring: string; icon: ReactNode; accent: string }> = {
  success: {
    ring: "border-jade-400/45",
    accent: "bg-jade-400",
    icon: <CheckIcon width={16} height={16} className="text-jade-300" />,
  },
  error: {
    ring: "border-coral-400/50",
    accent: "bg-coral-400",
    icon: <AlertIcon width={16} height={16} className="text-coral-300" />,
  },
  info: {
    ring: "border-saffron-400/45",
    accent: "bg-saffron-400",
    icon: <InfoIcon width={16} height={16} className="text-saffron-300" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-3), { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 6500 : 4200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast("success", title, description),
      error: (title, description) => toast("error", title, description),
      info: (title, description) => toast("info", title, description),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2.5">
        {toasts.map((item) => {
          const style = STYLES[item.kind];
          return (
            <div
              key={item.id}
              role="status"
              className={`animate-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border ${style.ring} glass-strong p-3.5 pr-10 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]`}
            >
              <span className={`absolute inset-y-0 left-0 w-[3px] ${style.accent}`} />
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8">
                {style.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-sand-100">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-sand-200/70">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="absolute right-2.5 top-2.5 rounded-full p-1 text-sand-200/60 transition hover:bg-white/10 hover:text-sand-100"
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}


