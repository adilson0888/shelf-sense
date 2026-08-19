import { useEffect, useState } from "react";

/** Chromium-only; not in lib.dom.d.ts. See MDN: BeforeInstallPromptEvent. */
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS's non-standard flag. iOS Safari never fires beforeinstallprompt
    // at all, so this branch is mostly inert there — kept for correctness
    // if this hook is ever reused somewhere that only checks isStandalone().
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Captures the deferred `beforeinstallprompt` event (Chromium-only — Firefox
 * and Safari never fire it, so `canInstall` simply stays false there) and
 * exposes a way to trigger the native install dialog on demand. See
 * InstallPromptBanner.tsx for the UI that consumes this.
 */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    if (installed) return;

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setDeferredEvent(null);
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [installed]);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferredEvent) return "unavailable";
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    // The captured event is single-use either way — Chrome won't fire
    // another beforeinstallprompt until the next eligible navigation, so
    // there's nothing left to re-offer from this hook instance.
    setDeferredEvent(null);
    return outcome;
  }

  return { canInstall: deferredEvent !== null, installed, promptInstall };
}
