import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Features } from "@/components/features";
import { Venues } from "@/components/venues";
import { Membership } from "@/components/membership";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1440px] px-12">
        <Header />
        <Hero />
        <HowItWorks />
        <Features />
        <Venues />
        <Membership />
      </div>
    </main>
  );
}
