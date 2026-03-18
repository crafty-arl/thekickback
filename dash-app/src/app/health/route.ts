export function GET() {
  return Response.json({ status: "ok", service: "dash-app", timestamp: Date.now() });
}
