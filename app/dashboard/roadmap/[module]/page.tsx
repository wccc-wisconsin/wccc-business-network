import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findModule, stepsForModule, tierMeetsMinimum } from "@/data/modules";
import {
  getMemberById,
  getModuleProgress,
  getModuleSummary,
  type ModuleSummary,
  type StepProgress,
} from "@/lib/appStore";
import StepCard from "@/components/StepCard";
import AICoach from "@/components/AICoach";
import ModuleSummaryPanel from "@/components/ModuleSummaryPanel";

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
// components/RoadmapModuleList.tsx. Modules with a full `phases` template
// (currently just Launch — see data/modules.ts) get the full AI Business
// Builder experience below; the rest fall back to the plain resource list
// until their phases/steps/questions are filled in, same shell either way.
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
  const steps = stepsForModule(mod);
  const hasGuidedSteps = steps.length > 0;

  const [progress, summary]: [Record<string, StepProgress>, ModuleSummary | null] =
    unlocked && hasGuidedSteps
      ? await Promise.all([getModuleProgress(userId, mod.key), getModuleSummary(userId, mod.key)])
      : [{}, null];

  const completedCount = steps.filter((s) => progress[s.key]?.completed).length;
  const percentComplete = hasGuidedSteps ? Math.round((completedCount / steps.length) * 100) : 0;
  const summaryTitle = mod.key === "launch" ? "Business Idea Summary" : `${mod.label} Summary`;

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

        {unlocked && hasGuidedSteps && (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm text-white/75">
              <span>{completedCount} of {steps.length} steps complete</span>
              <span>{percentComplete}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/12">
              <div className="h-3 rounded-full bg-[#d7a84d]" style={{ width: `${percentComplete}%` }} />
            </div>
          </div>
        )}

        {percentComplete === 100 && (
          <div className="mt-6 rounded-[8px] border border-emerald-400/40 bg-emerald-400/10 px-5 py-4">
            <p className="font-bold text-emerald-300">🎉 You&apos;ve completed the {mod.label} engine!</p>
            {next ? (
              <Link
                href={`/dashboard/roadmap/${next.key}`}
                className="mt-2 inline-block text-sm font-bold text-emerald-200 underline"
              >
                Continue to {next.label} →
              </Link>
            ) : (
              <p className="mt-1 text-sm text-emerald-200/80">
                That&apos;s every stage in this roadmap — nice work.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {!unlocked ? (
            <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-6 text-center">
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
          ) : hasGuidedSteps ? (
            <>
              {steps.map((step, i) => (
                <StepCard
                  key={step.key}
                  moduleKey={mod.key}
                  step={step}
                  initialAnswers={progress[step.key]?.answers ?? {}}
                  initialCompleted={progress[step.key]?.completed ?? false}
                  defaultOpen={i === 0}
                />
              ))}

              <ModuleSummaryPanel moduleKey={mod.key} defaultTitle={summaryTitle} initialSummary={summary} />

              <AICoach moduleKey={mod.key} moduleLabel={mod.label} />
            </>
          ) : (
            <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-6">
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
              <p className="mt-4 text-xs text-white/40">
                Guided steps for this stage are coming soon — the Launch engine has the full walkthrough today.
              </p>
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
