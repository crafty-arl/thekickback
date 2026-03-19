import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const service = createServiceClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  const { email, token } = await request.json();

  if (!email || !token) {
    return Response.json({ error: "Email and code required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  // Ensure profile exists
  if (data.user) {
    await service.from("profiles").upsert(
      { id: data.user.id, email: data.user.email },
      { onConflict: "id" }
    );
  }

  return Response.json({ success: true, userId: data.user?.id });
}
