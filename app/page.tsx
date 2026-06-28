import Header from "@/components/Header";
import Hero from "@/components/Hero";
import JourneyCards from "@/components/JourneyCards";
import Stats from "@/components/Stats";
import UpcomingEvents from "@/components/UpcomingEvents";
import ProgramGrid from "@/components/ProgramGrid";
import AiAssistantPanel from "@/components/AiAssistantPanel";
import Partners from "@/components/Partners";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07172b] text-white">
      <Header />
      <Hero />
      <JourneyCards />
      <Stats />

      <section className="bg-[#f8f1e7] px-6 py-12 text-[#07172b]">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <UpcomingEvents />
          <ProgramGrid />
        </div>
      </section>

      <AiAssistantPanel />
      <Partners />
    </main>
  );
}
