import Image from "next/image";
import Link from "next/link";
import { MOCK_STATS, MOCK_SESSIONS, MOCK_REQUESTS } from "@/lib/dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { GuestTable } from "@/components/dashboard/guest-table";
import { RequestFeed } from "@/components/dashboard/request-feed";
import { TextLog } from "@/components/dashboard/text-log";
import { OccupancyBar } from "@/components/dashboard/occupancy-bar";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 md:px-8">
        {/* Dashboard Header */}
        <header className="flex items-center justify-between border-b border-black/5 bg-[#FAFAFA] py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="theKickBack"
                width={140}
                height={46}
                className="h-8 w-auto md:h-[46px]"
                priority
              />
            </Link>
            <div className="hidden h-6 w-px bg-black/10 sm:block" />
            <span className="hidden font-sans text-sm font-medium text-black/40 sm:block">
              Venue Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
              <span className="font-sans text-sm font-medium text-black/60">The Rooftop</span>
            </div>
          </div>
        </header>

        {/* Venue info bar */}
        <div className="flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-black sm:text-3xl">
              The Rooftop
            </h1>
            <p className="font-sans text-sm text-black/45">
              Downtown &middot; Open 4 PM – 12 AM &middot; Text number: (877) 780-4236
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black px-4 py-2 font-mono text-xs font-medium text-orange">
              LIVE
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4 sm:gap-4">
          <StatCard label="IN VENUE NOW" value={MOCK_STATS.currentOccupancy} sub={`of ${MOCK_STATS.capacity} capacity`} accent />
          <StatCard label="TOTAL TODAY" value={MOCK_STATS.totalToday} sub="unique visitors" />
          <StatCard label="TEXTS TODAY" value={MOCK_STATS.totalTexts} sub="in + out" />
          <StatCard label="MEMBERS" value={MOCK_STATS.members} sub={`${MOCK_STATS.avgSessionMin} min avg session`} />
        </section>

        {/* Occupancy */}
        <section className="pb-6">
          <OccupancyBar stats={MOCK_STATS} />
        </section>

        {/* Main content: two columns */}
        <section className="flex flex-col gap-6 pb-8 lg:flex-row">
          {/* Left: Sessions + Requests */}
          <div className="flex flex-1 flex-col gap-6">
            <GuestTable sessions={MOCK_SESSIONS} />
            <RequestFeed requests={MOCK_REQUESTS} />
          </div>

          {/* Right: Live text feed */}
          <div className="w-full lg:w-[400px]">
            <TextLog />
          </div>
        </section>
      </div>
    </main>
  );
}
