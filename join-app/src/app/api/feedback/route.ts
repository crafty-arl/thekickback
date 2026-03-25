import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { sendEmail, wrap } from "@/lib/email";

export async function POST(req: NextRequest) {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Empty feedback" }, { status: 400 });

  // Send to admin
  sendEmail("carl@craftthefuture.xyz", `KB Feedback from ${user.email}`, wrap(`
    <h2 style="margin:0 0 12px;font-size:18px;color:#fff;">User Feedback</h2>
    <p style="color:rgba(255,255,255,0.5);font-size:13px;">From: <strong style="color:#fff;">${user.email}</strong></p>
    <div style="margin:16px 0;padding:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
      <p style="color:rgba(255,255,255,0.8);font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${message.trim()}</p>
    </div>
  `));

  return NextResponse.json({ ok: true });
}
