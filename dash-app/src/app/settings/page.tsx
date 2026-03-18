import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createService } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createService(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: ownership } = await service
    .from("venue_owners")
    .select("venue_id, role, venues(id, name, type, address)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!ownership) redirect("/onboarding");

  const venue = ownership.venues as unknown as { id: string; name: string; type: string; address: string };

  const { data: page } = await service
    .from("venue_pages")
    .select("slug, review_status, published")
    .eq("venue_id", venue.id)
    .single();

  const slug = page?.slug || venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const venueEmail = `${slug}@thekickback.net`;

  return (
    <main className="min-h-svh" style={{ backgroundColor: "#0A0A0A" }}>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(10,10,10,0.9)" }}>
        <div className="flex items-center gap-3">
          <Link href="/"><Image src="/logo.png" alt="theKickBack" width={100} height={33} className="h-6 w-auto" /></Link>
          <div className="hidden h-4 w-px sm:block" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          <span className="hidden font-sans text-[13px] font-medium sm:block" style={{ color: "rgba(255,255,255,0.35)" }}>Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-8 font-sans text-[24px] font-bold text-white">Settings</h1>

        <div className="flex flex-col gap-6">
          {/* Venue Email */}
          <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
            <h2 className="font-sans text-[16px] font-semibold text-white">Your KickBack Email</h2>
            <p className="mb-4 font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              Guests can email this address to interact with your venue. Replies are powered by AI.
            </p>
            <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "#F97316" }}>
                <span className="text-[18px]">✉</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[15px] font-semibold text-white">{venueEmail}</p>
                <p className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>Guests email here to JOIN, ASK, REQUEST, etc.</p>
              </div>
            </div>
          </section>

          {/* Venue Info */}
          <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
            <h2 className="mb-4 font-sans text-[16px] font-semibold text-white">Venue</h2>
            <div className="flex flex-col gap-3">
              <Row label="Name" value={venue.name} />
              <Row label="Type" value={venue.type || "—"} />
              <Row label="Address" value={venue.address || "—"} />
              <Row label="Slug" value={slug} />
              <Row label="Status" value={page?.published ? "Published" : "Pending review"} accent={page?.published ? "#4ADE80" : "#F97316"} />
              <Row label="Public URL" value={`join.thekickback.net/${slug}`} link={`https://join.thekickback.net/${slug}`} />
            </div>
            <Link href="/edit" className="mt-4 inline-block rounded-lg px-4 py-2 font-sans text-[13px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              Edit Venue Details
            </Link>
          </section>

          {/* AI Agent */}
          <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
            <h2 className="font-sans text-[16px] font-semibold text-white">AI Agent</h2>
            <p className="mb-4 font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              Your venue has its own AI that responds to guests. Give it context so it answers accurately.
            </p>
            <Link href="/agent" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-sans text-[14px] font-semibold text-black" style={{ backgroundColor: "#F97316" }}>
              <span>🤖</span> Manage Agent Knowledge
            </Link>
          </section>

          {/* Account */}
          <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
            <h2 className="mb-4 font-sans text-[16px] font-semibold text-white">Account</h2>
            <Row label="Email" value={user.email || "—"} />
            <Row label="Role" value={ownership.role} />
            <Row label="User ID" value={user.id.slice(0, 8) + "..."} />
            <div className="mt-4">
              <SignOutButton />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, link, accent }: { label: string; value: string; link?: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
      {link ? (
        <a href={link} target="_blank" className="font-sans text-[13px] font-medium underline" style={{ color: "#F97316" }}>{value}</a>
      ) : (
        <span className="font-sans text-[13px] font-medium" style={{ color: accent || "rgba(255,255,255,0.7)" }}>{value}</span>
      )}
    </div>
  );
}
