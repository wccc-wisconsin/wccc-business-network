import Link from "next/link";
import { redirect } from "next/navigation";
import {
  enrollInProgramAction,
  registerForEventAction,
  signOutAction,
} from "@/app/actions";
import { events } from "@/data/events";
import { programs } from "@/data/programs";
import { getCurrentMember, getMemberDashboard } from "@/lib/appStore";

export const runtime = "nodejs";
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
  const member = await getCurrentMember();

  if (!member) {
    redirect("/login");
  }

  const dashboard = await getMemberDashboard(member.id);
  const registeredTitles = new Set(
    dashboard.registrations.map((registration) => registration.eventTitle),
  );
  const enrolledTitles = new Set(
    dashboard.enrollments.map((enrollment) => enrollment.programTitle),
  );

  return (
    <main className="min-h-screen bg-[#07172b] text-white">
      <header className="border-b border-white/10 bg-[#061426] px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#d7a84d] font-serif text-xl font-bold text-[#07172b]">
              W
            </span>
            <span>
              <span className="block font-serif text-2xl font-bold">WCCC</span>
              <span className="block text-xs uppercase tracking-[0.22em] text-[#f1c864]">
                Member Dashboard
              </span>
            </span>
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/78 transition hover:border-[#d7a84d] hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[8px] border border-[#d7a84d]/30 bg-[#0b2544] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
              Welcome back
            </p>
            <h1 className="mt-3 font-serif text-5xl font-bold">{member.name}</h1>
            <p className="mt-3 text-sm leading-6 text-white/68">
              {member.businessName || "No organization added"} - {member.email}
            </p>

            <div className="mt-7">
              <div className="mb-2 flex justify-between text-sm text-white/75">
                <span>
                  {member.journey === "personal"
                    ? "Know Yourself"
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
          <div className="rounded-[8px] bg-[#f8f1e7] p-5 text-[#07172b]">
            <h2 className="font-serif text-3xl font-bold">Events</h2>
            <div className="mt-5 space-y-3">
              {events.map((event) => {
                const isRegistered = registeredTitles.has(event.title);

                return (
                  <article
                    key={event.title}
                    className="rounded-[8px] border border-[#07172b]/10 bg-white p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b6b1f]">
                      {event.category} - {event.date}
                    </p>
                    <h3 className="mt-2 text-lg font-bold">{event.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.time} - {event.location}
                    </p>
                    <form action={registerForEventAction} className="mt-4">
                      <input name="eventTitle" type="hidden" value={event.title} />
                      <button
                        disabled={isRegistered}
                        type="submit"
                        className="rounded-full bg-[#07172b] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#13345f] disabled:bg-slate-300 disabled:text-slate-600"
                      >
                        {isRegistered ? "Registered" : "Register"}
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-[8px] bg-[#f8f1e7] p-5 text-[#07172b]">
            <h2 className="font-serif text-3xl font-bold">Programs</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {programs.map((program) => {
                const isEnrolled = enrolledTitles.has(program.title);

                return (
                  <article
                    key={program.title}
                    className="rounded-[8px] border border-[#07172b]/10 bg-white p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b6b1f]">
                      {program.track}
                    </p>
                    <h3 className="mt-2 font-bold">{program.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {program.description}
                    </p>
                    <form action={enrollInProgramAction} className="mt-4">
                      <input
                        name="programTitle"
                        type="hidden"
                        value={program.title}
                      />
                      <button
                        disabled={isEnrolled}
                        type="submit"
                        className="rounded-full bg-[#07172b] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#13345f] disabled:bg-slate-300 disabled:text-slate-600"
                      >
                        {isEnrolled ? "Enrolled" : "Enroll"}
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[8px] border border-white/10 bg-[#0b2544] p-5">
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

          <div className="rounded-[8px] border border-white/10 bg-[#0b2544] p-5">
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
