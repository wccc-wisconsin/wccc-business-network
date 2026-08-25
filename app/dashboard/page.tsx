import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { headers } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import CommunityHubLinks from "@/components/CommunityHubLinks";
import { isModuleUnlocked, stepsForModule, tracksForJourney } from "@/data/modules";
import {
  getBusinessAssessment,
  getCompletedStepsByModule,
  getMemberById,
  getMemberDashboard,
  getMemberDecisions,
  getMemberFacts,
  getMemberOpportunities,
  recordMemberSignIn,
} from "@/lib/appStore";
import { SAVED_DECISIONS_LIMIT } from "@/data/decisions";
import AICoach from "@/components/AICoach";
import BusinessAssessmentCard from "@/components/BusinessAssessmentCard";
import ComplianceCalendar from "@/components/ComplianceCalendar";
import DashboardRoadmapTabs from "@/components/DashboardRoadmapTabs";
import DashboardSectionNav, { type DashboardSection } from "@/components/DashboardSectionNav";
import DecisionGrillPanel from "@/components/DecisionGrillPanel";
import RoadmapModuleList from "@/components/RoadmapModuleList";
import OpportunitiesPanel from "@/components/OpportunitiesPanel";

export const dynamic = "force-dynamic";

const tierLabels: Record<string, string> = {
  network: "Network",
  individual: "Individual",
  business: "Business",
  corporate: "Corporate",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const { userId, sessionId } = await auth();
  if (!userId) redirect("/login");

  const member = await getMemberById(userId);

  // No member record or incomplete intake form — send to onboarding
  if (!member || !member.industry) redirect("/onboarding");

  // Sign-in recording is analytics, and the member never sees it. It used to be
  // awaited right here, which meant every dashboard load blocked on a
  // login_events read before any dashboard data started loading — and on a
  // genuinely new session, on three sequential writes as well. That is four
  // round trips of latency spent on something outside the page.
  //
  // `after()` runs it once the response has been sent, so the ordering the
  // member experiences is: data queries start immediately, page renders,
  // analytics write happens on the way out.
  //
  // The user-agent has to be read out here, not inside the callback: by the
  // time `after` runs the response is finished and the request context is gone,
  // so calling headers() in there would throw.
  const userAgent = (await headers()).get("user-agent") ?? "Unknown browser";

  after(() =>
    // Caught rather than left to reject. Previously a Supabase outage during
    // this call would fail the whole dashboard render, because it was awaited
    // in the render path with no guard. Now the page has already been sent, and
    // a failed analytics write should be a log line rather than an unhandled
    // rejection in the function logs.
    recordMemberSignIn({
      clerkId: userId,
      email: member.email,
      sessionId,
      userAgent,
    }).catch((error) => {
      console.error("dashboard: recordMemberSignIn failed after response", error);
    }),
  );

  const [dashboard, memberOpportunities, businessAssessment, decisions, completedByModule, facts] =
    await Promise.all([
      getMemberDashboard(userId),
      getMemberOpportunities(userId),
      getBusinessAssessment(userId),
      getMemberDecisions(userId, SAVED_DECISIONS_LIMIT),
      getCompletedStepsByModule(userId),
      getMemberFacts(userId),
    ]);

  // Raw stored values (option values, not labels) — the Snapshot form needs
  // them to re-select the right radio and refill the right box.
  const factValues = Object.fromEntries(
    Object.entries(facts).map(([key, fact]) => [key, fact.value]),
  );
  const freeModuleKey = businessAssessment?.freeModuleKey ?? null;

  // Which roadmap(s) to show, from the journey picked at onboarding. The
  // matching lives in data/modules.ts (shared with the per-module detail page)
  // because it also has to account for tracks that are switched off — a member
  // who signed up for "Know Yourself" before that track was disabled falls back
  // to the business roadmap rather than to an empty dashboard.
  const roadmapTracks = tracksForJourney(member.journey);

  // Real roadmap progress, from completed guided steps.
  //
  // Denominator is the modules this member can actually open, not all seven —
  // measuring a network-tier member against six modules they can't unlock
  // would report ~4% and call it their progress. Modules without `phases`
  // (the ones still on the plain resource-list view) have no steps to
  // complete, so they're skipped on both sides of the ratio.
  //
  // Completed step keys are intersected with each module's current step list
  // because module_step_progress rows outlive edits to data/modules.ts —
  // counting stored rows directly would let progress exceed 100%.
  const unlockedModules = roadmapTracks
    .flatMap((track) => track.modules)
    .filter((mod) => isModuleUnlocked(member.membershipTier, mod, freeModuleKey));

  let totalSteps = 0;
  let completedSteps = 0;
  for (const mod of unlockedModules) {
    const steps = stepsForModule(mod);
    if (steps.length === 0) continue;
    const done = new Set(completedByModule[mod.key] ?? []);
    totalSteps += steps.length;
    completedSteps += steps.filter((step) => done.has(step.key)).length;
  }
  const roadmapProgress = totalSteps
    ? Math.round((completedSteps / totalSteps) * 100)
    : 0;
  const totalModules = roadmapTracks.reduce((n, track) => n + track.modules.length, 0);

  // Jump-nav targets for the sticky section nav. Built here rather than inside
  // the nav component so the list can't claim a section this particular member
  // doesn't get: the roadmap disappears if their journey matches no track, and
  // the upgrade banner only exists on the free tier. Every id below must match
  // an `id` on a wrapper in the markup — that pairing is what makes the links
  // work, so keep them together when adding a panel.
  const sectionNavItems: DashboardSection[] = [
    { id: "overview", label: "Overview" },
    { id: "snapshot", label: "Snapshot" },
    ...(roadmapTracks.length > 0
      ? [{ id: "roadmap", label: "Roadmap" } as DashboardSection]
      : []),
    { id: "coach", label: "AI Coach" },
    { id: "decisions", label: "Decisions" },
    { id: "funding", label: "Funding" },
    { id: "community", label: "Community" },
    { id: "deadlines", label: "Deadlines" },
    ...(member.membershipTier === "network"
      ? [{ id: "upgrade", label: "Upgrade" } as DashboardSection]
      : []),
    { id: "activity", label: "Activity" },
  ];

  return (
    <main className="min-h-screen bg-[#0f2d4a] text-white">
      <header className="border-b border-white/10 bg-[#091e33] px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#d7a84d] font-serif text-lg font-bold text-[#0f2d4a] sm:h-11 sm:w-11 sm:text-xl">
              W
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-xl font-bold sm:text-2xl">WCCC</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-[#f1c864] sm:text-xs sm:tracking-[0.22em]">
                Member Dashboard
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-4">
            {/* Hidden on phones: it's a long string next to the avatar in a
                cramped bar, and the welcome card below already shows it. */}
            <span className="hidden text-sm text-white/60 lg:inline">{member.email}</span>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Sticky jump-nav. Rendered first so it pins to the top of the
            viewport as soon as the header above scrolls away. */}
        <DashboardSectionNav sections={sectionNavItems} />

        <section id="overview" className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[8px] border border-[#d7a84d]/30 bg-[#132f52] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
              Welcome back
            </p>
            {/* Names and emails are member-supplied and can be long, so the
                display size steps down on narrow screens and both lines are
                allowed to break rather than push the card sideways. */}
            <h1 className="mt-3 break-words font-serif text-3xl font-bold sm:text-4xl lg:text-5xl">
              {member.name}
            </h1>
            <p className="mt-3 break-words text-sm leading-6 text-white/68">
              {member.businessName || "No organization added"} · {member.email}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {member.industry && (
                <span className="rounded border border-[#d7a84d]/30 bg-[#d7a84d]/10 px-3 py-1 text-xs font-semibold text-[#d7a84d]">
                  {member.industry}
                </span>
              )}
              {member.city && (
                <span className="rounded border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                  📍 {member.city}, WI
                </span>
              )}
              <span className={`rounded px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] ${
                member.membershipTier === "network"
                  ? "bg-white/10 text-white/50"
                  : member.membershipTier === "individual"
                  ? "bg-[#d7a84d]/20 text-[#d7a84d]"
                  : member.membershipTier === "business"
                  ? "bg-[#d7a84d]/30 text-[#d7a84d]"
                  : "bg-[#d7a84d] text-[#0f2d4a]"
              }`}>
                {member.membershipTier === "network" ? "Network (Free)" :
                 member.membershipTier === "individual" ? "Individual Member" :
                 member.membershipTier === "business" ? "Business Member" :
                 "Corporate Member"}
              </span>
            </div>

            <div className="mt-7">
              <div className="mb-2 flex justify-between text-sm text-white/75">
                <span>
                  {member.journey === "personal"
                    ? "Know Yourself"
                    : member.journey === "both"
                    ? "Both Journeys"
                    : "Know Your Business"}{" "}
                  progress
                </span>
                {/* Raw counts sit next to the percentage so the number is
                    checkable rather than something the member has to trust. */}
                <span>
                  {totalSteps > 0
                    ? `${completedSteps} of ${totalSteps} steps · ${roadmapProgress}%`
                    : "Not started"}
                </span>
              </div>
              <div className="h-3 rounded-full bg-white/12">
                <div
                  className="h-3 rounded-full bg-[#d7a84d] transition-all"
                  style={{ width: `${roadmapProgress}%` }}
                />
              </div>
              {/* totalSteps is 0 only when none of the member's unlocked
                  modules has guided steps yet — which today is every member on
                  the personal track, since those four modules have no `phases`
                  defined. Telling them to "start working through the steps"
                  would point at something that isn't there, so the copy points
                  at the resource lists that do exist. */}
              {totalSteps === 0 && (
                <p className="mt-2 text-xs text-white/45">
                  Guided steps for this track are still being built. The modules below have
                  resources you can use now.
                </p>
              )}
            </div>
          </div>

          {/* Four numbers a member can act on.
              "Events attended" and "Tracked sign-ins" used to sit here. The
              first is fed only by QR check-in, which is switched off, so it
              read 0 for everyone; the second was a security log presented as
              an achievement. Both are replaced with roadmap figures, which is
              what this dashboard is actually for. */}
          {/* Two-up on phones rather than four stacked full-width cards —
              four numbers shouldn't cost a screen and a half of scrolling
              before the member reaches anything they can act on. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="font-serif text-3xl font-bold text-[#d7a84d] sm:text-4xl">
                {completedSteps}
              </div>
              <div className="mt-1 text-xs text-white/70 sm:text-sm">
                Roadmap steps completed
              </div>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="font-serif text-3xl font-bold text-[#d7a84d] sm:text-4xl">
                {unlockedModules.length}
                <span className="text-xl text-white/35 sm:text-2xl">/{totalModules}</span>
              </div>
              <div className="mt-1 text-xs text-white/70 sm:text-sm">Modules unlocked</div>
            </div>
            {/* "Event registrations" and "Program enrollments" were here.
                Both counted rows that could only ever be created by the
                placeholder events and programs, so with those gone the
                numbers were frozen at zero — the same trap the two stats
                before them fell into. These two count things the member
                actually generates on this page. */}
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="font-serif text-3xl font-bold text-[#d7a84d] sm:text-4xl">
                {decisions.length}
              </div>
              <div className="mt-1 text-xs text-white/70 sm:text-sm">Decisions worked through</div>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="font-serif text-3xl font-bold text-[#d7a84d] sm:text-4xl">
                {memberOpportunities?.items.length ?? 0}
              </div>
              <div className="mt-1 text-xs text-white/70 sm:text-sm">Funding matches saved</div>
            </div>
          </div>
        </section>

        {/* Business Snapshot — 7-question dashboard card that classifies the
            member's business stage and unlocks one roadmap module free
            based on their stated top priority, regardless of membership
            tier. Sits above the roadmap since its free-unlock badge shows
            up there. See data/assessment.ts and components/BusinessAssessmentCard.tsx. */}
        {/* Each panel below is wrapped in an anchor div rather than having an
            id threaded into the component, so the jump-nav targets live in one
            readable list here next to `sectionNavItems`. The wrappers are
            layout-neutral — the panels keep their own `mt-6`, which collapses
            through the bare div. */}
        <div id="snapshot">
          <BusinessAssessmentCard
            key={businessAssessment?.updatedAt ?? "new"}
            initialAssessment={businessAssessment}
            initialFacts={factValues}
          />
        </div>

        {/* Roadmap(s) — 7-stage tracks, gated by membership tier (plus the
            one free module from the Business Snapshot above), chosen by
            journey. Members with only one track (business-only or
            personal-only) get that single section directly. Members on
            "both" get a tabbed view so Business Networking and Personal
            Networking are each spotlighted on their own tab instead of
            stacked one after another. */}
        {roadmapTracks.length > 1 ? (
          <div id="roadmap">
            <DashboardRoadmapTabs
              tracks={roadmapTracks}
              membershipTier={member.membershipTier}
              tierLabels={tierLabels}
              freeModuleKey={freeModuleKey}
            />
          </div>
        ) : (
          roadmapTracks.map((track) => (
            <section
              key={track.key}
              id="roadmap"
              className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-4 sm:p-6"
            >
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">{track.eyebrow}</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-white">{track.heading}</h2>
                <p className="mt-1 text-sm text-white/50">
                  {track.modules.length} stages of resources. Your {tierLabels[member.membershipTier]} membership
                  unlocks {track.modules.filter((m) => isModuleUnlocked(member.membershipTier, m, freeModuleKey)).length} of {track.modules.length}.
                </p>
              </div>

              <RoadmapModuleList
                key={track.key}
                modules={track.modules}
                membershipTier={member.membershipTier}
                tierLabels={tierLabels}
                freeModuleKey={freeModuleKey}
              />
            </section>
          ))
        )}

        {/* Decision Grill — the member names a decision they're weighing and
            gets interrogated on it one question at a time, then a written
            brief. Sits below the roadmap because it's for the questions the
            roadmap's fixed stages don't cover ("should I sign this lease?"),
            and above Funding & Programs because deciding usually comes first.
            See components/DecisionGrillPanel.tsx and app/api/ai/grill/route.ts. */}
        {/* The coach used to live only on module detail pages, so a member on
            the dashboard had no way to just ask a question — the only AI here
            was the Decision Grill, which requires you to already know you're
            weighing a decision. Mounted without a moduleKey it answers across
            their whole business, using the same context the grill gets. */}
        <div id="coach" className="mt-6">
          <AICoach />
        </div>

        <div id="decisions">
          <DecisionGrillPanel initialDecisions={decisions} />
        </div>

        <div id="funding">
          <OpportunitiesPanel initialOpportunities={memberOpportunities} />
        </div>

        <div id="community">
          <CommunityHubLinks />
        </div>

        {/* Compliance deadlines used to be one tab of a card whose other tab
            listed WCCC events, sitting beside a Programs card. The events and
            programs were placeholder content and are gone, so the deadline
            calendar — which is real, verified Wisconsin and federal filing
            dates — gets the section to itself. Real WCCC events are on the
            Hub, linked from the Community panel above.

            Keeps the light cream card the tab wrapper used to supply, since
            ComplianceCalendar is styled for a light background. */}
        <section id="deadlines" className="mt-6 rounded-[8px] bg-[#f8f1e7] p-4 text-[#0f2d4a] sm:p-5">
          <h2 className="mb-5 border-b border-[#0f2d4a]/10 pb-3 font-serif text-3xl font-bold">
            Deadlines
          </h2>
          <ComplianceCalendar facts={facts} />
        </section>

        {/* Upgrade banner for network (free) members */}
        {member.membershipTier === "network" && (
          <section
            id="upgrade"
            className="mt-6 rounded-[8px] border border-[#d7a84d]/40 bg-gradient-to-r from-[#d7a84d]/10 to-transparent p-5 sm:p-6"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d7a84d] mb-1">Unlock Full Membership</p>
                <h3 className="font-serif text-xl font-bold text-white">You&apos;re on the free network tier</h3>
                <p className="mt-1 text-sm text-white/60">Upgrade to unlock every stage of your roadmap instead of just the first.</p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                {[
                  { label: "Individual", price: "$150/yr" },
                  { label: "Business", price: "$300/yr" },
                  { label: "Corporate", price: "$1,500/yr" },
                ].map((t) => (
                  <a
                    key={t.label}
                    href={`mailto:info@wisccc.org?subject=Membership Upgrade - ${t.label}&body=I'd like to upgrade to ${t.label} membership (${ t.price}).`}
                    className="rounded border border-[#d7a84d]/50 px-4 py-2 text-xs font-bold text-[#d7a84d] transition hover:bg-[#d7a84d] hover:text-[#0f2d4a]"
                  >
                    {t.label} — {t.price}
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* A "Login audit" panel used to sit to the right of this, listing
            sign-in timestamps and raw user-agent strings. That's diagnostic
            output, not something a member benefits from seeing, so it's gone
            and Recent activity now takes the full width. Sign-ins are still
            recorded in login_events if an audit trail is ever needed. */}
        <section id="activity" className="mt-6">
          <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-4 sm:p-5">
            <h2 className="font-serif text-3xl font-bold">Recent activity</h2>
            <div className="mt-5 space-y-3">
              {dashboard.activities.length ? (
                dashboard.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-[8px] border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">{activity.title}</h3>
                      <span className="text-xs text-white/50">
                        {formatDate(activity.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/65">{activity.detail}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/65">No activity yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
