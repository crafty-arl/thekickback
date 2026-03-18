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
      className="rounded-lg border border-black/10 px-3 py-1.5 font-sans text-xs font-medium text-black/40 transition hover:border-black/20 hover:text-black/60"
    >
      Sign out
    </button>
  );
}
