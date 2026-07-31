import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkInForEventAction,
  enrollInProgramAction,
  registerForEventAction,
} from "@/app/actions";
import ActionButtonForm from "@/components/ActionButtonForm";
import CommunityHubLinks from "@/components/CommunityHubLinks";
import { events } from "@/data/events";
import { programs } from "@/data/programs";
import {
  roadmapTracks as allRoadmapTracks,
  isModuleUnlocked,
  stepsForModule,
} from "@/data/modules";
import {
  getBusinessAssessment,
  getCompletedStepsByModule,
  getMemberById,
  getMemberDashboard,
  getMemberDecisions,
  getMemberOpportunities,
  recordMemberSignIn,
} from "@/lib/appStore";
import { SAVED_DECISIONS_LIMIT } from "@/data/decisions";
import { slugifyEventTitle } from "@/lib/eventSlug";
import AICoach from "@/components/AICoach";
import BusinessAssessmentCard from "@/components/BusinessAssessmentCard";
import ComplianceCalendar from "@/components/ComplianceCalendar";
import DashboardRoadmapTabs from "@/components/DashboardRoadmapTabs";
import DecisionGrillPanel from "@/components/DecisionGrillPanel";
import RoadmapModuleList from "@/components/RoadmapModuleList";
import OpportunitiesPanel from "@/components/OpportunitiesPanel";

export const dynamic = "force-dynamic";

// The QR check-in feature (staff QR codes + member "Check in" button) needs
// the `event_attendance` table from supabase-schema.sql, which hasn't been
// migrated onto the live database yet. Until that migration runs, keep the
// UI hidden rather than showing a feature that can't record anything — the
// backend (recordEventAttendance, checkInForEventAction, the QR route) is
// left in place so this is a one-line flip once the table exists.
const CHECKIN_ENABLED = false;

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

type DashboardPageProps = {
  searchParams: Promise<{ checkin?: string; event?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { userId, sessionId } = await auth();
  if (!userId) redirect("/login");

  const member = await getMemberById(userId);

  // No member record or incomplete intake form — send to onboarding
  if (!member || !member.industry) redirect("/onboarding");

  const headerStore = await headers();
  await recordMemberSignIn({
    clerkId: userId,
    email: member.email,
    sessionId,
    userAgent: headerStore.get("user-agent") ?? "Unknown browser",
  });

  const { checkin, event: checkinSlug } = await searchParams;
  const checkinEventTitle = checkinSlug
    ? events.find((e) => slugifyEventTitle(e.title) === checkinSlug)?.title
    : undefined;

  // Absolute origin, used to build the QR check-in links below.
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const siteOrigin = `${protocol}://${host}`;

  // The QR check-in codes are a staff tool, not something every member needs
  // to see. There's no admin/role system in the members table yet, so gate
  // this on a simple env var (comma-separated staff emails) until one exists.
  const staffEmails = (process.env.STAFF_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isStaff = staffEmails.includes(member.email.toLowerCase());

  const [dashboard, memberOpportunities, businessAssessment, decisions, completedByModule] =
    await Promise.all([
      getMemberDashboard(userId),
      getMemberOpportunities(userId),
      getBusinessAssessment(userId),
      getMemberDecisions(userId, SAVED_DECISIONS_LIMIT),
      getCompletedStepsByModule(userId),
    ]);
  const freeModuleKey = businessAssessment?.freeModuleKey ?? null;
  const registeredTitles = new Set(
    dashboard.registrations.map((r) => r.eventTitle),
  );
  const enrolledTitles = new Set(
    dashboard.enrollments.map((e) => e.programTitle),
  );
  const attendedTitles = new Set(
    dashboard.attendance.map((a) => a.eventTitle),
  );

  // Which roadmap(s) to show depends on the journey picked at onboarding —
  // "business" and "personal" each get their own 7-stage track; "both" gets both.
  // Track copy/modules themselves live in data/modules.ts (shared with the
  // per-module detail page) — this just picks which tracks apply.
  const roadmapTracks = allRoadmapTracks.filter(
    (track) => track.key === member.journey || member.journey === "both",
  );

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

  return (
    <main className="min-h-screen bg-[#0f2d4a] text-white">
      <header className="border-b border-white/10 bg-[#091e33] px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#d7a84d] font-serif text-xl font-bold text-[#0f2d4a]">
              W
            </span>
            <span>
              <span className="block font-serif text-2xl font-bold">WCCC</span>
              <span className="block text-xs uppercase tracking-[0.22em] text-[#f1c864]">
                Member Dashboard
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60">{member.email}</span>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {checkin === "success" && (
          <div className="mb-6 rounded-[8px] border border-emerald-400/40 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-300">
            ✓ You&apos;re checked in{checkinEventTitle ? ` to ${checkinEventTitle}` : ""}. Thanks for coming out!
          </div>
        )}
        {checkin === "invalid" && (
          <div className="mb-6 rounded-[8px] border border-red-400/40 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-300">
            That check-in code didn&apos;t match a current event. Ask a staff member for help.
          </div>
        )}
        {/* The scan matched a real event but the write failed — usually because
            this account has no members row yet. Tell the attendee plainly
            instead of showing the success banner over a check-in that didn't
            happen (see app/api/checkin/[event]/route.ts). */}
        {checkin === "error" && (
          <div className="mb-6 rounded-[8px] border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-300">
            We couldn&apos;t record your check-in
            {checkinEventTitle ? ` for ${checkinEventTitle}` : ""}. Please scan again, or ask a
            staff member to check you in manually.
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[8px] border border-[#d7a84d]/30 bg-[#132f52] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
              Welcome back
            </p>
            <h1 className="mt-3 font-serif text-5xl font-bold">{member.name}</h1>
            <p className="mt-3 text-sm leading-6 text-white/68">
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-5">
              <div className="font-serif text-4xl font-bold text-[#d7a84d]">
                {completedSteps}
              </div>
              <div className="mt-1 text-sm text-white/70">
                Roadmap steps completed
              </div>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-5">
              <div className="font-serif text-4xl font-bold text-[#d7a84d]">
                {unlockedModules.length}
                <span className="text-2xl text-white/35">/{totalModules}</span>
              </div>
              <div className="mt-1 text-sm text-white/70">Modules unlocked</div>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-5">
              <div className="font-serif text-4xl font-bold text-[#d7a84d]">
                {dashboard.registrations.length}
              </div>
              <div className="mt-1 text-sm text-white/70">Event registrations</div>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-5">
              <div className="font-serif text-4xl font-bold text-[#d7a84d]">
                {dashboard.enrollments.length}
              </div>
              <div className="mt-1 text-sm text-white/70">Program enrollments</div>
            </div>
          </div>
        </section>

        {/* Business Snapshot — 7-question dashboard card that classifies the
            member's business stage and unlocks one roadmap module free
            based on their stated top priority, regardless of membership
            tier. Sits above the roadmap since its free-unlock badge shows
            up there. See data/assessment.ts and components/BusinessAssessmentCard.tsx. */}
        {/* Sits above the Snapshot because it's the one panel with dates that
            pass whether or not the member acts. Needs no input and makes no AI
            call, so it's populated the instant the page renders. */}
        <ComplianceCalendar />

        <BusinessAssessmentCard
          key={businessAssessment?.updatedAt ?? "new"}
          initialAssessment={businessAssessment}
        />

        {/* Roadmap(s) — 7-stage tracks, gated by membership tier (plus the
            one free module from the Business Snapshot above), chosen by
            journey. Members with only one track (business-only or
            personal-only) get that single section directly. Members on
            "both" get a tabbed view so Business Networking and Personal
            Networking are each spotlighted on their own tab instead of
            stacked one after another. */}
        {roadmapTracks.length > 1 ? (
          <DashboardRoadmapTabs
            tracks={roadmapTracks}
            membershipTier={member.membershipTier}
            tierLabels={tierLabels}
            freeModuleKey={freeModuleKey}
          />
        ) : (
          roadmapTracks.map((track) => (
            <section key={track.key} className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-6">
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
        <div className="mt-6">
          <AICoach />
        </div>

        <DecisionGrillPanel initialDecisions={decisions} />

        <OpportunitiesPanel initialOpportunities={memberOpportunities} />

        <CommunityHubLinks />

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[8px] bg-[#f8f1e7] p-5 text-[#0f2d4a]">
            <h2 className="font-serif text-3xl font-bold">Events</h2>
            <div className="mt-5 space-y-3">
              {events.map((event) => {
                const isRegistered = registeredTitles.has(event.title);
                const hasAttended = attendedTitles.has(event.title);
                return (
                  <article
                    key={event.title}
                    className="rounded-[8px] border border-[#0f2d4a]/10 bg-white p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b6b1f]">
                      {event.category} · {event.date}
                    </p>
                    <h3 className="mt-2 text-lg font-bold">{event.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.time} · {event.location}
                    </p>
                    <div className="mt-4 flex flex-wrap items-start gap-2">
                      <ActionButtonForm
                        action={registerForEventAction}
                        fieldName="eventTitle"
                        fieldValue={event.title}
                        disabled={isRegistered}
                        idleLabel="Register"
                        disabledLabel="Registered"
                        pendingLabel="Registering…"
                        className="rounded-full bg-[#0f2d4a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#13345f] disabled:bg-slate-300 disabled:text-slate-600"
                      />
                      {CHECKIN_ENABLED && isRegistered && (
                        <ActionButtonForm
                          action={checkInForEventAction}
                          fieldName="eventTitle"
                          fieldValue={event.title}
                          disabled={hasAttended}
                          idleLabel="Check in"
                          disabledLabel="✓ Attended"
                          pendingLabel="Checking in…"
                          className="rounded-full border border-[#0f2d4a] px-4 py-2 text-sm font-bold text-[#0f2d4a] transition hover:bg-[#0f2d4a] hover:text-white disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent"
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-[8px] bg-[#f8f1e7] p-5 text-[#0f2d4a]">
            <h2 className="font-serif text-3xl font-bold">Programs</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {programs.map((program) => {
                const isEnrolled = enrolledTitles.has(program.title);
                return (
                  <article
                    key={program.title}
                    className="rounded-[8px] border border-[#0f2d4a]/10 bg-white p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b6b1f]">
                      {program.track}
                    </p>
                    <h3 className="mt-2 font-bold">{program.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {program.description}
                    </p>
                    {member.membershipTier === "network" ? (
                      <div className="mt-4 rounded border border-[#d7a84d]/30 bg-[#fdf6ec] px-3 py-2 text-xs text-[#9b6b1f]">
                        🔒 Upgrade to access programs
                      </div>
                    ) : (
                      <div className="mt-4">
                        <ActionButtonForm
                          action={enrollInProgramAction}
                          fieldName="programTitle"
                          fieldValue={program.title}
                          disabled={isEnrolled}
                          idleLabel="Enroll"
                          disabledLabel="Enrolled"
                          pendingLabel="Enrolling…"
                          className="rounded-full bg-[#0f2d4a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#13345f] disabled:bg-slate-300 disabled:text-slate-600"
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Staff tool: a QR code per event that, when scanned by an attendee
            who's signed in on their phone, checks them in automatically —
            no form, no extra tap. Print/display these at the venue.
            Only visible to staff (see STAFF_EMAILS above) — regular members
            don't need or want to see every event's check-in link. */}
        {CHECKIN_ENABLED && isStaff && (
          <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-5">
            <h2 className="font-serif text-2xl font-bold">Event check-in codes</h2>
            <p className="mt-1 text-sm text-white/60">
              Display the QR code for an event at the venue. Attendees scan it with their
              phone (while signed in) to check themselves in — the count updates instantly.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const checkinUrl = `${siteOrigin}/api/checkin/${slugifyEventTitle(event.title)}`;
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(checkinUrl)}`;
                return (
                  <div
                    key={event.title}
                    className="rounded-[8px] border border-white/10 bg-white/5 p-4 text-center"
                  >
                    <p className="text-sm font-bold">{event.title}</p>
                    <img
                      src={qrImageUrl}
                      alt={`Check-in QR code for ${event.title}`}
                      width={160}
                      height={160}
                      className="mx-auto mt-3 rounded bg-white p-2"
                    />
                    <p className="mt-2 break-all text-xs text-white/45">{checkinUrl}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Upgrade banner for network (free) members */}
        {member.membershipTier === "network" && (
          <section className="mt-6 rounded-[8px] border border-[#d7a84d]/40 bg-gradient-to-r from-[#d7a84d]/10 to-transparent p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d7a84d] mb-1">Unlock Full Membership</p>
                <h3 className="font-serif text-xl font-bold text-white">You&apos;re on the free network tier</h3>
                <p className="mt-1 text-sm text-white/60">Upgrade to access programs, Office Hours, mentorship, and member-only events.</p>
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
        <section className="mt-6">
          <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-5">
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
