import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EventTicker from "@/components/EventTicker";
import Stats from "@/components/Stats";
import LiveActivity from "@/components/LiveActivity";
import JourneyCards from "@/components/JourneyCards";
import UpcomingEvents from "@/components/UpcomingEvents";
import ProgramGrid from "@/components/ProgramGrid";
import AiAssistantPanel from "@/components/AiAssistantPanel";
import MembershipCTA from "@/components/MembershipCTA";
import Partners from "@/components/Partners";
import Footer from "@/components/Footer";

// LiveActivity queries Supabase for real counts — ISR every 5 minutes keeps
// the homepage fast (no per-request DB hit) while staying reasonably fresh.
export const revalidate = 300;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf8f5] text-[#0c1e3a]">
      <Header />
      <Hero />
      <EventTicker />
      <Stats />
      <LiveActivity />
      <JourneyCards />

      <section id="events" className="bg-white px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <UpcomingEvents />
          <ProgramGrid />
        </div>
      </section>

      <AiAssistantPanel />
      <MembershipCTA />
      <Partners />
      <Footer />
    </main>
  );
}
