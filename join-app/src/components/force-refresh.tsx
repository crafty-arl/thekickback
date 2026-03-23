"use client";

export function ForceRefresh() {
  return (
    <button
      onClick={() => {
        if (typeof caches !== "undefined") caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
        if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
        window.location.href = window.location.pathname + "?t=" + Date.now();
      }}
      style={{ position: "fixed", top: 2, right: 4, zIndex: 80, fontSize: 8, color: "rgba(255,255,255,0.12)", fontFamily: "monospace", background: "none", border: "none", padding: "2px 4px", cursor: "pointer" }}
    >
      v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
    </button>
  );
}
