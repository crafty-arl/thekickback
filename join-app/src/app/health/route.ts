export function GET() {
  return Response.json({ status: "ok", service: "join-app", timestamp: Date.now() });
}
