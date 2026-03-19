/**
 * Generates a stable device fingerprint based on browser/device characteristics.
 * Stored in localStorage so it persists across sessions on the same device.
 * NOT spoofable via simple means — combines multiple signals.
 */

const STORAGE_KEY = "kb_device_id";

async function generateFingerprint(): Promise<string> {
  const signals: string[] = [];

  // Screen
  signals.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  signals.push(`${window.devicePixelRatio}`);

  // Timezone
  signals.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  signals.push(navigator.language);

  // Platform
  signals.push(navigator.platform);

  // Hardware concurrency
  signals.push(`${navigator.hardwareConcurrency || 0}`);

  // Max touch points
  signals.push(`${navigator.maxTouchPoints || 0}`);

  // WebGL renderer (GPU fingerprint)
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl && gl instanceof WebGLRenderingContext) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        signals.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch {
    // WebGL not available
  }

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("KickBack.fp", 2, 15);
      signals.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    // Canvas not available
  }

  // Hash all signals into a stable ID
  const raw = signals.join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getDeviceId(): Promise<string> {
  // Check localStorage first
  if (typeof window === "undefined") return "";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  // Generate and persist
  const id = await generateFingerprint();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
