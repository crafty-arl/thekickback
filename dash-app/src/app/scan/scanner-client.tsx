"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

interface PendingItem {
  id: string;
  type: string;
  label: string;
  status: string;
  created_at: string;
}

interface ScanResult {
  user: { id: string; name: string; email: string; tier: string; balance_cents: number };
  pending: PendingItem[];
  memberships: { venue_name: string; tier: string }[];
  error?: string;
}

interface Props {
  venueId: string;
  venueName: string;
}

export function ScannerClient({ venueId, venueName }: Props) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fulfilling, setFulfilling] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      // Start scanning frames for QR codes
      scanIntervalRef.current = window.setInterval(() => {
        scanFrame();
      }, 500);
    } catch {
      setError("Camera access denied. Check your browser permissions.");
    }
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Use BarcodeDetector if available (Chrome, Safari 16.4+)
    if ("BarcodeDetector" in window) {
      const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: HTMLCanvasElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ["qr_code"] });
      detector.detect(canvas).then((barcodes) => {
        if (barcodes.length > 0) {
          handleQRData(barcodes[0].rawValue);
        }
      }).catch(() => {});
    }
  }, []);

  const handleQRData = useCallback(async (raw: string) => {
    // Parse kb://{userId}/{timestamp}/{hmac}
    const match = raw.match(/^kb:\/\/([^/]+)\/(\d+)\/([a-f0-9]+)$/);
    if (!match) {
      // Also try URL-encoded format
      const urlMatch = raw.match(/kb%3A%2F%2F([^%/]+)%2F(\d+)%2F([a-f0-9]+)/i);
      if (!urlMatch) return; // Not a KickBack QR
    }

    stopCamera();

    const payload = raw.startsWith("kb://") ? raw.replace("kb://", "") : decodeURIComponent(raw).replace("kb://", "");

    try {
      const res = await fetch(`https://thekickback.net/wallet/scan/${encodeURIComponent(payload)}?venue=${venueId}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setResult({
        user: {
          id: data.user_id,
          name: data.display_name || data.email?.split("@")[0] || "Guest",
          email: data.email || "",
          tier: data.tier || "explorer",
          balance_cents: data.balance_cents || 0,
        },
        pending: (data.pending_items || []).filter((p: PendingItem) => p.status === "ready"),
        memberships: data.memberships || [],
      });
    } catch {
      setError("Failed to verify QR code. Try again.");
    }
  }, [venueId, stopCamera]);

  const handleFulfill = async (itemId: string) => {
    setFulfilling(itemId);
    try {
      const res = await fetch(`https://thekickback.net/wallet/redeem/${itemId}`, { method: "POST" });
      const data = await res.json();
      if (data.ok || data.status === "fulfilled") {
        setResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pending: prev.pending.map((p) => p.id === itemId ? { ...p, status: "fulfilled" } : p),
          };
        });
      }
    } catch { /* skip */ }
    setFulfilling(null);
  };

  // Cleanup on unmount
  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const tierColors: Record<string, string> = {
    explorer: "#9CA3AF", regular: "#F97316", member: "#8B5CF6", vip: "#F59E0B",
  };
  const tierColor = tierColors[result?.user.tier || "explorer"] || "#9CA3AF";

  return (
    <main className="min-h-dvh bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Image src="/logo.png" alt="theKickBack" width={100} height={33} className="h-6 w-auto" />
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <span className="font-sans text-[12px] text-white/30">Scanner</span>
        </div>
        <span className="font-sans text-[11px] text-white/40">{venueName}</span>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        {/* Camera view */}
        {scanning && (
          <div className="relative mb-4 overflow-hidden rounded-2xl" style={{ aspectRatio: "4/3", border: "2px solid rgba(249,115,22,0.3)" }}>
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {/* Scan overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-2xl border-2 border-orange/50" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }} />
            </div>
            <p className="absolute bottom-4 left-0 right-0 text-center font-sans text-[12px] text-white/50">
              Point at customer&apos;s wallet pass QR
            </p>
            <button
              onClick={stopCamera}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Start scan button */}
        {!scanning && !result && (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl" style={{ backgroundColor: "rgba(249,115,22,0.1)", border: "2px solid rgba(249,115,22,0.2)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <rect x="7" y="7" width="10" height="10" rx="1" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="font-sans text-[20px] font-bold text-white">Scan to Verify</h1>
              <p className="mt-1 font-sans text-[13px] text-white/40">Scan a customer&apos;s KickBack pass to see their orders and fulfill them.</p>
            </div>
            <button
              onClick={startCamera}
              className="rounded-2xl px-8 py-4 font-sans text-[15px] font-bold text-black active:scale-[0.97]"
              style={{ backgroundColor: "#F97316" }}
            >
              Open Scanner
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl px-4 py-3 text-center" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="font-sans text-[13px] text-red-400">{error}</p>
            <button
              onClick={() => { setError(null); startCamera(); }}
              className="mt-2 font-sans text-[12px] font-bold text-orange"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Scan result */}
        {result && (
          <div className="flex flex-col gap-4">
            {/* Customer card */}
            <div className="rounded-2xl px-5 py-4" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${tierColor}25` }}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`, border: `2px solid ${tierColor}40` }}>
                  <span className="font-sans text-[18px] font-bold" style={{ color: tierColor }}>{result.user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <p className="font-sans text-[16px] font-bold text-white">{result.user.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${tierColor}15`, color: tierColor }}>
                      {result.user.tier}
                    </span>
                    <span className="font-mono text-[11px] text-white/30">
                      ${(result.user.balance_cents / 100).toFixed(2)} balance
                    </span>
                  </div>
                </div>
              </div>

              {/* Memberships at this venue */}
              {result.memberships.length > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(249,115,22,0.06)" }}>
                  <span className="text-[14px]">{"\u{1F451}"}</span>
                  <span className="font-sans text-[12px] font-semibold text-orange">Member</span>
                </div>
              )}
            </div>

            {/* Pending items */}
            {result.pending.length > 0 ? (
              <div>
                <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25">PENDING ITEMS</p>
                <div className="flex flex-col gap-2">
                  {result.pending.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{
                        backgroundColor: item.status === "fulfilled" ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${item.status === "fulfilled" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      <div className="flex-1">
                        <p className="font-sans text-[14px] font-semibold text-white/90">{item.label}</p>
                        <p className="font-sans text-[10px] text-white/30">{item.type}</p>
                      </div>
                      {item.status === "fulfilled" ? (
                        <span className="rounded-full px-3 py-1 font-sans text-[11px] font-bold text-green-400" style={{ backgroundColor: "rgba(74,222,128,0.1)" }}>
                          Done
                        </span>
                      ) : (
                        <button
                          onClick={() => handleFulfill(item.id)}
                          disabled={fulfilling === item.id}
                          className="rounded-xl px-4 py-2 font-sans text-[12px] font-bold text-black active:scale-[0.97] disabled:opacity-50"
                          style={{ backgroundColor: "#4ADE80" }}
                        >
                          {fulfilling === item.id ? "..." : "Fulfill"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl px-4 py-6 text-center" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                <p className="font-sans text-[13px] text-white/30">No pending items at {venueName}</p>
                {result.memberships.length > 0 && (
                  <p className="mt-1 font-sans text-[11px] text-orange">Active member — perks apply</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { setResult(null); startCamera(); }}
                className="flex-1 rounded-xl py-3 font-sans text-[13px] font-bold text-black active:scale-[0.97]"
                style={{ backgroundColor: "#F97316" }}
              >
                Scan Another
              </button>
              <Link
                href="/"
                className="flex items-center justify-center rounded-xl px-6 py-3 font-sans text-[13px] font-medium text-white/40 active:scale-[0.97]"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                Back
              </Link>
            </div>
          </div>
        )}

        {/* Manual entry fallback */}
        {!scanning && !result && (
          <div className="mt-8 text-center">
            <p className="font-sans text-[11px] text-white/20">Camera not working? Ask the customer for their ID code.</p>
          </div>
        )}
      </div>
    </main>
  );
}
