import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  enrollInProgramAction,
  registerForEventAction,
} from "@/app/actions";
import { events } from "@/data/events";
import { programs } from "@/data/programs";
import {
  getMemberById,
  getMemberDashboard,
  recordMemberSignIn,
} from "@/lib/appStore";

export const dynamic = "force-dynamic";

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

  const clerkUser = await currentUser();
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

  const dashboard = await getMemberDashboard(userId);
  const registeredTitles = new Set(
    dashboard.registrations.map((r) => r.eventTitle),
  );
  const enrolledTitles = new Set(
    dashboard.enrollments.map((e) => e.programTitle),
  );

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
                <span>{dashboard.progress}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/12">
                <div
                  className="h-3 rounded-full bg-[#d7a84d]"
                  style={{ width: `${dashboard.progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
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
            <div className="rounded-[8px] border border-white/10 bg-white/5 p-5">
              <div className="font-serif text-4xl font-bold text-[#d7a84d]">
                {dashboard.loginEvents.length}
              </div>
              <div className="mt-1 text-sm text-white/70">Tracked sign-ins</div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[8px] bg-[#f8f1e7] p-5 text-[#0f2d4a]">
            <h2 className="font-serif text-3xl font-bold">Events</h2>
            <div className="mt-5 space-y-3">
              {events.map((event) => {
                const isRegistered = registeredTitles.has(event.title);
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
                    <form action={registerForEventAction} className="mt-4">
                      <input name="eventTitle" type="hidden" value={event.title} />
                      <button
                        disabled={isRegistered}
                        type="submit"
                        className="rounded-full bg-[#0f2d4a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#13345f] disabled:bg-slate-300 disabled:text-slate-600"
                      >
                        {isRegistered ? "Registered" : "Register"}
                      </button>
                    </form>
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
                      <form action={enrollInProgramAction} className="mt-4">
                        <input name="programTitle" type="hidden" value={program.title} />
                        <button
                          disabled={isEnrolled}
                          type="submit"
                          className="rounded-full bg-[#0f2d4a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#13345f] disabled:bg-slate-300 disabled:text-slate-600"
                        >
                          {isEnrolled ? "Enrolled" : "Enroll"}
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Upgrade banner for network (free) members */}
        {member.membershipTier === "network" && (
          <section className="mt-6 rounded-[8px] border border-[#d7a84d]/40 bg-gradient-to-r from-[#d7a84d]/10 to-transparent p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d7a84d] mb-1">Unlock Full Membership</p>
                <h3 className="font-serif text-xl font-bold text-white">You're on the free network tier</h3>
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

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
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

          <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-5">
            <h2 className="font-serif text-3xl font-bold">Login audit</h2>
            <div className="mt-5 space-y-3">
              {dashboard.loginEvents.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="rounded-[8px] border border-white/10 bg-white/5 p-4"
                >
                  <div className="font-bold">{formatDate(event.at)}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-white/55">
                    {event.userAgent}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
