import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Features } from "@/components/features";
import { Venues } from "@/components/venues";
import { Membership } from "@/components/membership";

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      {/* Top gradient accent */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-orange/[0.04] blur-[120px]" />
        <div className="absolute -bottom-40 right-0 h-[400px] w-[600px] rounded-full bg-orange/[0.02] blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 md:px-12">
        <Header />
        <Hero />
        <HowItWorks />
        <Features />
        <Venues />
        <Membership />

        {/* Footer */}
        <footer className="flex flex-col items-center gap-3 border-t border-white/[0.06] py-10 text-center">
          <span className="font-sans text-[10px] font-medium tracking-[2.5px] text-white/25">
            THEKICKBACK
          </span>
          <span className="font-sans text-xs text-white/20">
            The digital front door for real-world venues.
          </span>
        </footer>
      </div>
    </main>
  );
}
