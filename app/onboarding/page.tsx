import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { completeProfileAction } from "@/app/actions";
import { getMemberById } from "@/lib/appStore";
import { industryOptions } from "@/data/industries";

export const dynamic = "force-dynamic";

// This form asks for four things and nothing else. Two questions used to sit
// here and no longer do:
//
//   - **Which journey interests you most?** The personal track has no guided
//     steps and is switched off (PERSONAL_TRACK_ENABLED in data/modules.ts), so
//     the question had one possible answer and was already hiding itself.
//     completeProfileAction sets the business track for every new member; the
//     stored `journey` of anyone who answered it before is untouched.
//   - **Choose your membership.** Picking a tier used to decide which roadmap
//     stages opened, on the honour system, with no payment anywhere in the
//     flow. Tier gating is off now (TIER_GATING_ENABLED in data/modules.ts) —
//     every member gets every stage — so the question decided nothing and asked
//     someone to price themselves before they had seen anything. The public
//     site still sells memberships; that is where it belongs.
//
// What is left is only what the portal genuinely cannot start without: who they
// are, and what and where the business is.


export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const member = await getMemberById(userId);
  if (member && member.industry) redirect("/dashboard");

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";

  return (
    <main className="min-h-screen bg-[#faf8f5] px-6 py-16">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wccc-logo.jpg" alt="WCCC" className="mx-auto h-16 w-16 rounded-full object-cover mb-5" />
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#a07830] mb-2">Welcome to WCCC</p>
          <h1 className="font-serif text-3xl font-bold text-[#0c1e3a]">Tell us about yourself</h1>
          <p className="mt-2 text-sm text-[#64748b]">
            Four questions, about a minute. Everything the portal offers is open to every member —
            this is just so your coach knows whose business it is talking about.
          </p>
        </div>

        <form action={completeProfileAction} className="space-y-8">
          {/* Profile card */}
          <div className="rounded-xl border border-[#e8e3db] bg-white p-8 shadow-sm space-y-5">
            <h2 className="font-serif text-lg font-bold text-[#0c1e3a] mb-1">Your Profile</h2>

            {/* Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-1.5">
                Full Name <span className="text-[#c9993a]">*</span>
              </label>
              <input
                required
                name="name"
                type="text"
                defaultValue={clerkUser?.fullName ?? ""}
                placeholder="Jane Smith"
                className="w-full rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-3 text-sm text-[#0c1e3a] placeholder-[#94a3b8] outline-none transition focus:border-[#a07830] focus:ring-1 focus:ring-[#a07830]/20"
              />
            </div>

            {/* Email read-only */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded border border-[#e8e3db] bg-[#f1ede7] px-4 py-3 text-sm text-[#94a3b8] outline-none cursor-not-allowed"
              />
            </div>

            {/* Business */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-1.5">
                Business or Organization
              </label>
              <input
                name="businessName"
                type="text"
                placeholder="Smith Studio (leave blank if not applicable)"
                className="w-full rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-3 text-sm text-[#0c1e3a] placeholder-[#94a3b8] outline-none transition focus:border-[#a07830] focus:ring-1 focus:ring-[#a07830]/20"
              />
            </div>

            {/* Industry + City */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-1.5">
                  Industry <span className="text-[#c9993a]">*</span>
                </label>
                <select
                  required
                  name="industry"
                  defaultValue=""
                  className="w-full rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-3 text-sm text-[#0c1e3a] outline-none transition focus:border-[#a07830] focus:ring-1 focus:ring-[#a07830]/20"
                >
                  <option value="" disabled>Select…</option>
                  {/* Shared with the profile card (components/MemberProfileCard.tsx)
                      so the two forms cannot offer different options for the
                      same column — and so the Grants.gov keyword each choice
                      searches for lives beside it. See data/industries.ts. */}
                  {industryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.value}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-1.5">City / Region</label>
                <input
                  name="city"
                  type="text"
                  placeholder="Madison"
                  className="w-full rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-3 text-sm text-[#0c1e3a] placeholder-[#94a3b8] outline-none transition focus:border-[#a07830] focus:ring-1 focus:ring-[#a07830]/20"
                />
              </div>
            </div>

          </div>

          <button
            type="submit"
            className="w-full rounded bg-[#0c1e3a] px-6 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#1a3358]"
          >
            Join WCCC — Access My Dashboard →
          </button>

          {/* Terms of Use and Privacy Policy were links pointing at href="#",
              which went nowhere — worse than plain text on a consent line,
              since it looks like the policies are one click away. Kept as text
              until real /terms and /privacy pages exist, then re-link here. */}
          <p className="text-center text-xs text-[#94a3b8]">
            By joining you agree to our Terms of Use and Privacy Policy.
          </p>
        </form>
      </div>
    </main>
  );
}
