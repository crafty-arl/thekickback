import { fetchApprovedVenues } from "@/lib/fetch-venues";
import { LandingPage } from "@/components/landing-page";

export default async function HomePage() {
  const venues = await fetchApprovedVenues();
  return <LandingPage venues={venues} />;
}
