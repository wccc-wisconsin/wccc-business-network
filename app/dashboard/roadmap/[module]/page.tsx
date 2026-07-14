import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findModule, tierMeetsMinimum } from "@/data/modules";
import { getMemberById } from "@/lib/appStore";

const tierLabels: Record<string, string> = {
  network: "Network",
  individual: "Individual",
  business: "Business",
  corporate: "Corporate",
};

type ModulePageProps = {
  params: Promise<{ module: string }>;
};

// Detail page for a single roadmap stage (e.g. /dashboard/roadmap/launch).
// Linked from the "Learn more" button on each roadmap card in
// components/RoadmapModuleList.tsx. Kept as its own route (rather than an
// in-page expansion) so each stage has a real, shareable/bookmarkable URL.
export default async function ModulePage({ params }: ModulePageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const member = await getMemberById(userId);
  if (!member || !member.industry) redirect("/onboarding");

  const { module: moduleSlug } = await params;
  const found = findModule(moduleSlug);
  if (!found) notFound();

  const { track, module: mod, prev, next } = found;
  const unlocked = tierMeetsMinimum(member.membershipTier, mod.minTier);

  return (
    <main className="min-h-screen bg-[#0f2d4a] text-white">
      <header className="border-b border-white/10 bg-[#091e33] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
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
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.15em] text-white/50 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
          {track.eyebrow} · Stage {track.modules.indexOf(mod) + 1} of {track.modules.length}
        </p>

        <div className="mt-3 flex items-center gap-4">
          <span className="text-5xl">{mod.icon}</span>
          <h1 className="font-serif text-4xl font-bold">{mod.label}</h1>
        </div>
        <p className="mt-3 text-base text-white/60">{mod.tagline}</p>

        <div className="mt-8 rounded-[8px] border border-white/10 bg-[#132f52] p-6">
          {unlocked ? (
            <>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                Resources in this stage
              </h2>
              <ul className="mt-4 space-y-3">
                {mod.resources.map((r) => (
                  <li
                    key={r}
                    className="rounded-[8px] border border-[#d7a84d]/25 bg-[#d7a84d]/5 px-4 py-3 text-sm text-white/85"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-center">
              <p className="text-3xl">🔒</p>
              <p className="mt-3 font-serif text-xl font-bold">
                Unlock this stage at {tierLabels[mod.minTier]} tier
              </p>
              <p className="mt-2 text-sm text-white/60">
                Your current membership is {tierLabels[member.membershipTier]}. Upgrade to unlock{" "}
                {mod.resources.length} resource{mod.resources.length === 1 ? "" : "s"} in this stage.
              </p>
              <a
                href={`mailto:info@wisccc.org?subject=Membership Upgrade&body=I'd like to upgrade to ${tierLabels[mod.minTier]} membership.`}
                className="mt-5 inline-block rounded border border-[#d7a84d]/50 px-4 py-2 text-xs font-bold text-[#d7a84d] transition hover:bg-[#d7a84d] hover:text-[#0f2d4a]"
              >
                Upgrade membership
              </a>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={`/dashboard/roadmap/${prev.key}`}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 transition hover:border-[#d7a84d]/40 hover:text-white"
            >
              ← {prev.label}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/dashboard/roadmap/${next.key}`}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/60 transition hover:border-[#d7a84d]/40 hover:text-white"
            >
              {next.label} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </main>
  );
}
