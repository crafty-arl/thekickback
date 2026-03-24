"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg border border-white/10 px-3 py-1.5 font-sans text-xs font-medium text-white/40 transition hover:border-white/20 hover:text-white/60"
    >
      Sign out
    </button>
  );
}
