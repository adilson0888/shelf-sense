import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * specs/Barcode Scanner & Product info scrape.md's capture mechanism — the
 * browser `BarcodeDetector` API, no polyfill (see that spec's Out of
 * scope). Chromium-based browsers only as of this writing; Safari/Firefox
 * callers must check `isBarcodeScanSupported()` before ever offering the
 * scan option (Inventory.tsx/ProductList.tsx's "+ Add" branch on this).
 */

// Not yet in TypeScript's DOM lib (not a Baseline-widely-available API) —
// minimal ambient shape for just what this file calls.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];
const POLL_INTERVAL_MS = 300;

export function isBarcodeScanSupported(): boolean {
  // Camera access (getUserMedia) is refused outright on an insecure origin
  // (plain HTTP other than localhost itself) — checking only for
  // BarcodeDetector would still claim "supported" there and open the
  // capture modal onto a guaranteed camera-denied dead end instead of
  // falling straight to manual entry like every other unsupported case.
  return typeof window !== "undefined" && window.isSecureContext && "BarcodeDetector" in window;
}

export type ScanError = "unsupported" | "camera-denied" | null;

export interface UseBarcodeScanResult {
  /** Attach to the <video> element that shows the live feed. */
  videoRef: RefObject<HTMLVideoElement | null>;
  error: ScanError;
}

/**
 * Runs a live camera feed through BarcodeDetector while `active` is true.
 * Calls `onDetect` at most once per activation (the first successful
 * decode) — per the spec, decoding completes the capture step
 * automatically, no separate "Capture" tap. Fully tears down the camera
 * stream and polling loop on deactivation/unmount, so leaving the capture
 * screen (Cancel, or a successful detect) never leaves the camera light on.
 */
export function useBarcodeScan(active: boolean, onDetect: (code: string) => void): UseBarcodeScanResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<ScanError>(null);
  // Ref, not a dependency — onDetect is typically a fresh closure every
  // render in the calling component; capturing it via a ref means the
  // effect below doesn't need to restart the camera every time.
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  useEffect(() => {
    if (!active) return;
    setError(null);

    if (!window.BarcodeDetector) {
      setError("unsupported");
      return;
    }
    const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });

    let stream: MediaStream | null = null;
    let stopped = false;
    let pollTimer: number | null = null;

    async function poll() {
      if (stopped || !videoRef.current) return;
      try {
        const detected = await detector.detect(videoRef.current);
        if (detected.length > 0 && !stopped) {
          onDetectRef.current(detected[0].rawValue);
          return; // found one — stop polling, let the caller close/react
        }
      } catch {
        // Transient (e.g. video not ready for a frame yet) — keep polling.
      }
      if (!stopped) pollTimer = window.setTimeout(poll, POLL_INTERVAL_MS);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        if (!stopped) setError("camera-denied");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      poll();
    }

    start();

    return () => {
      stopped = true;
      if (pollTimer) window.clearTimeout(pollTimer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active]);

  return { videoRef, error };
}
