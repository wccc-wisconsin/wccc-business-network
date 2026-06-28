import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { completeProfileAction } from "@/app/actions";
import { getMemberById } from "@/lib/appStore";

export const dynamic = "force-dynamic";

const industries = [
  "Technology",
  "Food & Beverage",
  "Healthcare",
  "Retail",
  "Professional Services",
  "Education",
  "Real Estate",
  "Finance & Accounting",
  "Construction & Trades",
  "Arts & Media",
  "Nonprofit",
  "Other",
];

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  // Already completed onboarding — go straight to dashboard
  const member = await getMemberById(userId);
  if (member) redirect("/dashboard");

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";

  return (
    <main className="min-h-screen bg-[#faf8f5] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wccc-logo.jpg" alt="WCCC" className="mx-auto h-16 w-16 rounded-full object-cover mb-5" />
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#a07830] mb-2">
            Welcome to WCCC
          </p>
          <h1 className="font-serif text-3xl font-bold text-[#0c1e3a]">
            Tell us about yourself
          </h1>
          <p className="mt-2 text-sm text-[#64748b]">
            Takes 60 seconds. You'll have full member access right after.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-xl border border-[#e8e3db] bg-white p-8 shadow-sm">
          <form action={completeProfileAction} className="space-y-5">

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

            {/* Email (read-only) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-1.5">
                Email
              </label>
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

            {/* Industry + City side by side */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-1.5">
                  Industry
                </label>
                <select
                  name="industry"
                  className="w-full rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-3 text-sm text-[#0c1e3a] outline-none transition focus:border-[#a07830] focus:ring-1 focus:ring-[#a07830]/20"
                >
                  <option value="">Select…</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-1.5">
                  City / Region
                </label>
                <input
                  name="city"
                  type="text"
                  placeholder="Madison"
                  className="w-full rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-3 text-sm text-[#0c1e3a] placeholder-[#94a3b8] outline-none transition focus:border-[#a07830] focus:ring-1 focus:ring-[#a07830]/20"
                />
              </div>
            </div>

            {/* Journey */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-3">
                Which journey interests you most? <span className="text-[#c9993a]">*</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-4 transition hover:border-[#a07830] has-[:checked]:border-[#a07830] has-[:checked]:bg-[#fdf6ec]">
                  <input
                    defaultChecked
                    name="journey"
                    type="radio"
                    value="business"
                    className="mt-0.5 h-4 w-4 accent-[#a07830]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#0c1e3a]">Know Your Business</span>
                    <span className="block text-xs text-[#64748b] mt-0.5">Grow and scale your enterprise</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-4 transition hover:border-[#a07830] has-[:checked]:border-[#a07830] has-[:checked]:bg-[#fdf6ec]">
                  <input
                    name="journey"
                    type="radio"
                    value="personal"
                    className="mt-0.5 h-4 w-4 accent-[#a07830]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#0c1e3a]">Know Yourself</span>
                    <span className="block text-xs text-[#64748b] mt-0.5">Leadership and personal growth</span>
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded bg-[#0c1e3a] px-6 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#1a3358]"
            >
              Join WCCC — Access My Dashboard →
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[#94a3b8]">
          By joining you agree to our{" "}
          <a href="#" className="underline hover:text-[#0c1e3a]">Terms of Use</a>{" "}
          and{" "}
          <a href="#" className="underline hover:text-[#0c1e3a]">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
