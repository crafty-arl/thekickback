"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthButton() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (email) {
    return (
      <button
        onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.refresh();
        }}
        className="rounded-full border border-black/10 px-3 py-1.5 font-sans text-xs font-medium text-black/40 transition hover:border-black/20 hover:text-black/60"
      >
        Sign out
      </button>
    );
  }

  return (
    <a
      href="/login"
      className="rounded-full bg-orange px-4 py-2 font-sans text-sm font-medium text-black transition-colors hover:bg-orange/90"
    >
      Sign in
    </a>
  );
}
