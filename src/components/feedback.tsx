"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Button, cn } from "@/components/ui";

// A single, app-wide feedback layer: styled confirm dialogs (replacing the raw
// browser confirm) and lightweight toasts with optional Undo. Mounted once in
// the app layout; consumed via useToast() / useConfirm().

// --- Types ------------------------------------------------------------------

type ToastTone = "success" | "error" | "info";
type ToastAction = { label: string; onClick: () => void };

type ToastOptions = {
  description?: string;
  action?: ToastAction;
  /** ms before auto-dismiss; 0 keeps it until dismissed. */
  duration?: number;
};

type ToastInput = ToastOptions & { tone: ToastTone; title: string };
type Toast = ToastInput & { id: number };

type ConfirmInput = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" (default) styles the confirm as destructive and focuses Cancel. */
  tone?: "danger" | "default";
};
type ConfirmState = ConfirmInput & { id: number; resolve: (ok: boolean) => void };

type FeedbackApi = {
  push: (t: ToastInput) => number;
  dismiss: (id: number) => void;
  confirm: (c: ConfirmInput) => Promise<boolean>;
};

const FeedbackCtx = createContext<FeedbackApi | null>(null);

const TONES: Record<ToastTone, { Icon: typeof Info; icon: string; border: string }> = {
  success: { Icon: CheckCircle2, icon: "text-success", border: "border-success/30" },
  error: { Icon: AlertCircle, icon: "text-danger", border: "border-danger/30" },
  info: { Icon: Info, icon: "text-info", border: "border-info/30" },
};

// --- Provider ---------------------------------------------------------------

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((xs) => xs.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    const id = (idRef.current += 1);
    setToasts((xs) => [...xs, { ...input, id }]);
    return id;
  }, []);

  const confirm = useCallback((input: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      const id = (idRef.current += 1);
      setConfirmState((prev) => {
        prev?.resolve(false); // cancel any dialog already open
        return { ...input, id, resolve };
      });
    });
  }, []);

  const closeConfirm = useCallback((ok: boolean) => {
    setConfirmState((prev) => {
      prev?.resolve(ok);
      return null;
    });
  }, []);

  const api = useMemo<FeedbackApi>(() => ({ push, dismiss, confirm }), [push, dismiss, confirm]);

  return (
    <FeedbackCtx.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onRemove={dismiss} />
      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </FeedbackCtx.Provider>
  );
}

// --- Toasts -----------------------------------------------------------------

function ToastViewport({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center px-4 pb-4 sm:inset-x-auto sm:right-0 sm:items-end sm:px-6 sm:pb-6">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onRemove={onRemove} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

function ToastRow({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = toast.duration ?? (toast.action ? 6500 : 4000);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), 170);
  }, [onRemove, toast.id]);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (duration <= 0) return;
    clearTimer();
    timer.current = setTimeout(close, duration);
  }, [duration, close, clearTimer]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  const cfg = TONES[toast.tone];
  const Icon = cfg.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-float",
        cfg.border,
        leaving ? "luna-toast-out" : "luna-toast-in",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", cfg.icon)}>
        <Icon size={18} strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-fg">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-[13px] text-fg-muted">{toast.description}</p> : null}
      </div>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            close();
          }}
          className="shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-accent-strong transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={close}
        className="-mr-1 shrink-0 rounded-md p-1 text-fg-subtle transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X size={15} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

// --- Confirm dialog ---------------------------------------------------------

const DANGER_BTN =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-danger px-4 text-[14px] " +
  "font-medium text-white shadow-raise transition-[filter,transform] duration-150 hover:brightness-105 " +
  "hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]";

function ConfirmDialog({ state, onClose }: { state: ConfirmState | null; onClose: (ok: boolean) => void }) {
  const danger = state?.tone !== "default";

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      // Enter confirms only for non-destructive dialogs — never for a delete.
      if (e.key === "Enter" && !danger) onClose(true);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Focus the safe default: Cancel for danger, Confirm otherwise.
    const el = document.querySelector<HTMLElement>("[data-confirm-autofocus]");
    el?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [state, danger, onClose]);

  if (!state || typeof document === "undefined") return null;
  const confirmLabel = state.confirmLabel ?? (danger ? "Delete" : "Confirm");
  const cancelLabel = state.cancelLabel ?? "Cancel";

  return createPortal(
    <div
      className="luna-fade fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[rgba(11,18,32,0.6)] backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6" onClick={() => onClose(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="luna-pop shadow-float w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="flex items-start gap-3.5 px-6 pt-6">
            {danger ? (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
                <AlertTriangle size={20} strokeWidth={2} aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold tracking-tight text-fg">{state.title}</h2>
              {state.message ? (
                <div className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">{state.message}</div>
              ) : null}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-border-soft bg-muted/30 px-6 py-4">
            <Button
              variant="secondary"
              onClick={() => onClose(false)}
              {...(danger ? { "data-confirm-autofocus": true } : {})}
            >
              {cancelLabel}
            </Button>
            {danger ? (
              <button type="button" onClick={() => onClose(true)} className={DANGER_BTN} data-confirm-autofocus>
                {confirmLabel}
              </button>
            ) : (
              <Button onClick={() => onClose(true)} data-confirm-autofocus>
                {confirmLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// --- Hooks ------------------------------------------------------------------

function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackCtx);
  if (!ctx) throw new Error("useToast/useConfirm must be used within <FeedbackProvider>");
  return ctx;
}

export type ToastApi = {
  success: (title: string, opts?: ToastOptions) => number;
  error: (title: string, opts?: ToastOptions) => number;
  info: (title: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
};

/** Toasts: `toast.success("Saved")`, or with an action for undo-on-delete. */
export function useToast(): ToastApi {
  const { push, dismiss } = useFeedback();
  return useMemo(
    () => ({
      success: (title, opts) => push({ tone: "success", title, ...opts }),
      error: (title, opts) => push({ tone: "error", title, ...opts }),
      info: (title, opts) => push({ tone: "info", title, ...opts }),
      dismiss,
    }),
    [push, dismiss],
  );
}

/** Styled confirm: `if (await confirm({ title: "Delete X?" })) { ... }`. */
export function useConfirm(): (c: ConfirmInput) => Promise<boolean> {
  return useFeedback().confirm;
}
