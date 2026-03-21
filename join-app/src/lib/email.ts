const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = "theKickBack <hub@thekickback.net>";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY || !to) return;
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  }).catch((err) => console.error(`Email to ${to} failed:`, err));
}

export function wrap(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;">
  <div style="max-width:480px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="https://thekickback.net/logo.png" alt="theKickBack" width="120" style="display:inline-block;" />
    </div>
    ${content}
    <p style="margin-top:32px;font-size:11px;color:rgba(255,255,255,0.2);text-align:center;">
      theKickBack &mdash; tap in, text in, you're in
    </p>
  </div>
</body>
</html>`;
}
