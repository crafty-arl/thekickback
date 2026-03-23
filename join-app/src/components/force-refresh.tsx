"use client";

export function ForceRefresh() {
  return (
    <button
      onClick={() => {
        if (typeof caches !== "undefined") caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
        if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
        window.location.href = window.location.pathname + "?t=" + Date.now();
      }}
      style={{ position: "fixed", bottom: 6, left: 6, zIndex: 9999, fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "4px 8px", cursor: "pointer" }}
    >
      {process.env.NEXT_PUBLIC_APP_VERSION || "dev"} ↻
    </button>
  );
}
