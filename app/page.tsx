import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import LiveActivity from "@/components/LiveActivity";
import JourneyCards from "@/components/JourneyCards";
import HubHighlights from "@/components/HubHighlights";
import AiAssistantPanel from "@/components/AiAssistantPanel";
import MembershipCTA from "@/components/MembershipCTA";
import Partners from "@/components/Partners";
import Footer from "@/components/Footer";

// LiveActivity queries Supabase for real counts. This must render at request
// time, not build time — ISR (`revalidate`) would make Next.js prerender the
// page during `next build`, which fails if Supabase env vars aren't present
// in that environment (e.g. this repo's Vercel Preview builds don't have
// them, only Production does). force-dynamic guarantees Supabase is only
// ever queried per-request, after the app is actually running.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf8f5] text-[#0c1e3a]">
      <Header />
      <Hero />
      <Stats />
      <LiveActivity />
      <JourneyCards />

      {/* An "Upcoming Events" list and an "Our Programs" grid used to sit here,
          both built from placeholder data that described events and programs
          WCCC doesn't actually run. They're gone rather than rewritten: real
          WCCC events are published on the Wisconsin Asian Hub, and the Hub
          block below is now the site's route to them.

          That also makes this block load-bearing rather than supplementary —
          it's the only place a signed-out visitor can find out what's
          genuinely happening, so it moved up directly under the pathways. */}
      <HubHighlights />

      <AiAssistantPanel />
      <MembershipCTA />
      <Partners />
      <Footer />
    </main>
  );
}
