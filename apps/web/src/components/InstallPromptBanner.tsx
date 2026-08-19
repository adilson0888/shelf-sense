import { useState } from "react";
import { Alert, Button } from "shelf-sense-ds";
import { useT } from "shelf-sense-i18n/react";
import { useInstallPrompt } from "../lib/useInstallPrompt";

const DISMISS_STORAGE_KEY = "ss-install-prompt-dismissed";

function isDismissed(): boolean {
  return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "true";
}

/**
 * Inline "Install ShelfSense" banner, shown once the browser has offered an
 * install (beforeinstallprompt fired — Chromium only) and the user hasn't
 * already dismissed it or installed the app. See useInstallPrompt.ts.
 */
export function InstallPromptBanner() {
  const { t } = useT();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissedState] = useState(isDismissed);

  if (!canInstall || dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, "true");
    setDismissedState(true);
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    // Accepted or dismissed the native dialog — either way, stop asking.
    if (outcome !== "unavailable") dismiss();
  }

  return (
    <div className="px-sm pt-sm">
      <Alert variant="info" title={t("installPrompt.title")}>
        <p>{t("installPrompt.description")}</p>
        <div className="mt-xs flex gap-sm">
          <Button variant="primary" size="sm" onClick={handleInstall}>
            {t("installPrompt.install")}
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            {t("installPrompt.notNow")}
          </Button>
        </div>
      </Alert>
    </div>
  );
}
