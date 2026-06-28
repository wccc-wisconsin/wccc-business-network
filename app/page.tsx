import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EventTicker from "@/components/EventTicker";
import JourneyCards from "@/components/JourneyCards";
import UpcomingEvents from "@/components/UpcomingEvents";
import ProgramGrid from "@/components/ProgramGrid";
import AiAssistantPanel from "@/components/AiAssistantPanel";
import MembershipCTA from "@/components/MembershipCTA";
import Partners from "@/components/Partners";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0f2d4a] text-white">
      <Header />
      <Hero />
      <EventTicker />
      <JourneyCards />

      <section id="events" className="bg-[#f8f1e7] px-6 py-12 text-[#0f2d4a]">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
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
