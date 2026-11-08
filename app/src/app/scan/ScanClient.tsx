"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { parseBadgeText } from "@/lib/badge";

type ScanResult = {
  ok: true;
  scan_id?: string;
  replay?: boolean;
  receiver: { name: string; role: string; descriptor?: string | null };
  breakdown: Array<{ label: string; points: number }>;
  base: number;
  tier: number;
  tier_mult: number;
  scan_points: number;
  day_seq: number;
};

type ScanError = {
  ok: false;
  code: string;
  message: string;
};

type ScanState =
  | { kind: "scanning" }
  | { kind: "result"; result: ScanResult; receiverRole: string }
  | { kind: "error"; code: string; message: string }
  | { kind: "manual" };

function getRoleVar(role: string) {
  const r = role?.toLowerCase();
  if (["artificer", "broker", "weaver", "patron"].includes(r)) return `var(--${r})`;
  return "var(--brass)";
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    artificer: "ARTIFICER", broker: "BROKER", weaver: "WEAVER", patron: "PATRON",
  };
  return map[role?.toLowerCase()] ?? role?.toUpperCase();
}

function ScanSheet({ result, onScanAgain }: { result: ScanResult; onScanAgain: () => void }) {
  const roleColor = getRoleVar(result.receiver.role);
  const tierLabel = result.tier === 1 ? "Full value" : result.tier === 2 ? "Half value" : "Quarter value";
  const rungText = `Rung ${result.day_seq} of 15 · ${tierLabel.toLowerCase()}`;

  return (
    <div
      className="scan-sheet"
      role="dialog"
      aria-label={`Scan result: ${result.receiver.name}`}
    >
      <div className="scan-sheet-grabber" aria-hidden="true" />

      {/* Role + name */}
      <div style={{ padding: "0 24px", flex: 1, overflowY: "auto" }}>
        <div
          className="text-label"
          style={{ color: roleColor, marginBottom: 4, letterSpacing: "0.15em" }}
        >
          ● {getRoleLabel(result.receiver.role)}
        </div>
        <div style={{ fontSize: 22, color: "var(--paper)", marginBottom: 4 }}>
          {result.receiver.name}
          {result.receiver.descriptor && (
            <span style={{ fontSize: 14, color: "var(--muted)", marginLeft: 8 }}>
              — &ldquo;{result.receiver.descriptor}&rdquo;
            </span>
          )}
        </div>

        <div className="brass-rule" aria-hidden="true" />

        {/* Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {result.breakdown.map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: i < result.breakdown.length - 1 ? "var(--stroke)" : "none",
                opacity: line.points === 0 ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: 15, color: "var(--paper-dim)" }}>{line.label}</span>
              <span
                className="font-num"
                style={{ fontSize: 15, color: line.points > 0 ? "var(--brass)" : "var(--muted)" }}
              >
                {line.points > 0 ? `+ ${line.points}` : `+ 0`}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "16px 0 8px",
            borderTop: "var(--stroke-brass)",
            marginTop: 4,
          }}
        >
          <span
            className="font-display"
            style={{ fontSize: 13, color: "var(--muted)", letterSpacing: "0.1em" }}
          >
            MARK
          </span>
          <span
            className="font-num"
            style={{ fontSize: 28, color: "var(--brass)" }}
            aria-label={`${result.scan_points} points`}
          >
            +{result.scan_points.toFixed(2)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>{rungText}</div>

        {result.replay && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(216,180,90,0.08)",
              border: "1px solid rgba(216,180,90,0.2)",
              borderRadius: "var(--r-in)",
              fontSize: 13,
              color: "var(--brass)",
              marginBottom: 16,
            }}
          >
            This mark was already recorded — showing the original result.
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
          <button className="btn btn-secondary" style={{ minHeight: 44, fontSize: 14 }}>
            Echo note
          </button>
          <button className="btn btn-secondary" style={{ minHeight: 44, fontSize: 14 }}>
            Challenge
          </button>
        </div>
      </div>

      {/* Scan again button */}
      <div style={{ padding: "12px 24px", borderTop: "var(--stroke)" }}>
        <button
          className="btn btn-primary btn-full"
          onClick={onScanAgain}
        >
          Done, scan again
        </button>
      </div>
    </div>
  );
}

function ErrorSheet({ code, message, onClose }: { code: string; message: string; onClose: () => void }) {
  const isAlreadyPaired = code === "ALREADY_PAIRED";
  return (
    <div className="scan-sheet" role="dialog" aria-label="Scan error">
      <div className="scan-sheet-grabber" aria-hidden="true" />
      <div style={{ padding: "0 24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: "50%",
            border: `2px solid ${isAlreadyPaired ? "var(--brass)" : "var(--error)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20, fontSize: 24,
            color: isAlreadyPaired ? "var(--brass)" : "var(--error)",
          }}
        >
          {isAlreadyPaired ? "⬡" : "✕"}
        </div>
        <p style={{ fontSize: 18, color: "var(--paper)", marginBottom: 8, lineHeight: 1.3 }}>
          {message}
        </p>
        {code && (
          <p style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {code}
          </p>
        )}
      </div>
      <div style={{ padding: "12px 24px", borderTop: "var(--stroke)" }}>
        <button className="btn btn-primary btn-full" onClick={onClose}>
          Scan again
        </button>
      </div>
    </div>
  );
}

export default function ScanClient({ player }: { player: Record<string, unknown> }) {
  const [state, setState] = useState<ScanState>({ kind: "scanning" });
  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const clientUuidRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraError("");
    } catch {
      setCameraError("Camera not available. Use the code entry below.");
    }
  }, []);

  useEffect(() => {
    if (state.kind === "scanning") {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [state.kind, startCamera, stopCamera]);

  // BarcodeDetector scanning loop
  useEffect(() => {
    if (state.kind !== "scanning" || cameraError) return;
    if (!("BarcodeDetector" in window)) return; // fallback to zxing (not loaded here)

    // @ts-expect-error BarcodeDetector is not in lib types
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    let cancelled = false;

    const scan = async () => {
      if (cancelled || !videoRef.current || scanningRef.current) return;
      if (videoRef.current.readyState < 2) {
        setTimeout(scan, 200);
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0 && !scanningRef.current) {
          const raw = barcodes[0].rawValue as string;
          const parsed = parseBadgeText(raw);
          if (parsed) {
            scanningRef.current = true;
            await submitScan({ code: parsed.code, via: "qr" });
          }
        }
      } catch { /* detect error, keep going */ }
      if (!cancelled) setTimeout(scan, 500);
    };

    scan();
    return () => { cancelled = true; };
  }, [state.kind, cameraError]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitScan({ code, via }: { code: string; via: string }) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const clientUuid = `${clientUuidRef.current}-${code}`;
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, via, clientUuid }),
      });
      const data = await res.json() as ScanResult | ScanError;
      if (data.ok) {
        // Success vibration
        if (typeof navigator.vibrate === "function") navigator.vibrate(15);
        setState({ kind: "result", result: data as ScanResult, receiverRole: (data as ScanResult).receiver.role });
      } else {
        const e = data as ScanError;
        setState({ kind: "error", code: e.code, message: e.message });
      }
    } catch {
      setState({ kind: "error", code: "NETWORK", message: "The ledger did not answer. Nothing was lost." });
    } finally {
      setSubmitting(false);
      scanningRef.current = false;
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) return;
    await submitScan({ code, via: "code" });
    setManualCode("");
  }

  function resetScan() {
    setState({ kind: "scanning" });
    scanningRef.current = false;
    // New client UUID for next scan
    clientUuidRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const role = (player.role as string | undefined)?.toLowerCase() ?? "artificer";

  return (
    <main
      style={{
        position: "fixed", inset: 0,
        background: "var(--ink-950)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Back nav */}
      <div
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          left: 16,
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          className="btn btn-ghost"
          style={{ minHeight: 36, padding: "0 12px", fontSize: 14 }}
          aria-label="Back to deck"
        >
          ← Deck
        </Link>
      </div>

      {/* Camera viewport */}
      {state.kind === "scanning" && (
        <div style={{ position: "relative", flex: 1, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            aria-hidden="true"
          />

          {/* Scan frame */}
          <div
            style={{
              position: "relative",
              width: "68%",
              aspectRatio: "1",
              borderRadius: 20,
              border: `2px solid var(--${role})`,
              boxShadow: `0 0 0 9999px rgba(7,8,11,0.6), inset 0 0 0 1px rgba(0,0,0,0.3)`,
              zIndex: 2,
            }}
            aria-label="Align badge QR code here"
          >
            {/* Animated scan line */}
            <div
              style={{
                position: "absolute",
                left: 4, right: 4, height: 2,
                background: `linear-gradient(90deg, transparent, var(--${role}), transparent)`,
                borderRadius: 1,
                animation: "scan-line 2.4s ease-in-out infinite",
              }}
            />
          </div>

          {/* Camera error */}
          {cameraError && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                textAlign: "center",
                zIndex: 5,
              }}
            >
              <p style={{ color: "var(--paper-dim)", fontSize: 15, marginBottom: 8 }}>{cameraError}</p>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Use the code entry below.</p>
            </div>
          )}

          {/* Type instead */}
          <div
            style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              padding: "16px 24px",
              background: "linear-gradient(to top, rgba(7,8,11,0.95), transparent)",
              zIndex: 5,
            }}
          >
            <form onSubmit={submitManual} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                className="input input-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={7}
                placeholder="042 917"
                value={manualCode}
                onChange={e => setManualCode(e.target.value.replace(/[^\d\s]/g, "").slice(0, 7))}
                style={{ flex: 1, minHeight: 48, fontSize: 20 }}
                aria-label="Type badge code manually"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !/^\d{6}$/.test(manualCode.replace(/\s/g, ""))}
                style={{ minHeight: 48, padding: "0 20px" }}
              >
                Go
              </button>
            </form>
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--faint)", marginTop: 8 }}>
              Type the 6-digit code if the camera isn&apos;t working
            </p>
          </div>
        </div>
      )}

      {/* Result sheet */}
      {state.kind === "result" && (
        <>
          {/* Background with role ring animation */}
          <div
            style={{
              flex: 1,
              background: "var(--ink-950)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 200, height: 200,
                borderRadius: "50%",
                background: `var(--${state.receiverRole?.toLowerCase() ?? "brass"}-glow, var(--brass-deep))`,
                opacity: 0.15,
                animation: "ring-expand 620ms var(--ease) forwards",
              }}
              aria-hidden="true"
            />
          </div>
          <ScanSheet
            result={state.result}
            onScanAgain={resetScan}
          />
        </>
      )}

      {/* Error sheet */}
      {state.kind === "error" && (
        <>
          <div style={{ flex: 1, background: "var(--ink-950)" }} />
          <ErrorSheet code={state.code} message={state.message} onClose={resetScan} />
        </>
      )}

      {/* Scan line animation */}
      <style>{`
        @keyframes scan-line {
          0%, 100% { top: 4px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          50% { top: calc(100% - 6px); }
        }
      `}</style>
    </main>
  );
}

