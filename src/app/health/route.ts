export function GET() {
  return Response.json({ status: "ok", service: "landing-page", timestamp: Date.now() });
}
