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

const tiers = [
  {
    value: "network",
    label: "Network",
    price: "Free",
    description: "Join the community",
    perks: ["Community directory", "Public events", "Newsletter", "One-time help requests"],
    highlight: false,
  },
  {
    value: "individual",
    label: "Individual Member",
    price: "$150",
    period: "/year",
    description: "For professionals",
    perks: ["Everything in Network", "All programs & Office Hours", "Mentorship matching", "Member-only events"],
    highlight: false,
  },
  {
    value: "business",
    label: "Business Member",
    price: "$300",
    period: "/year",
    description: "For businesses & startups",
    perks: ["Everything in Individual", "Business resources", "Startup support", "Priority advising"],
    highlight: true,
  },
  {
    value: "corporate",
    label: "Corporate Member",
    price: "$1,500",
    period: "/year",
    description: "For organizations",
    perks: ["Everything in Business", "Up to 10 staff seats", "Prominent directory listing", "Sponsorship opportunities"],
    highlight: false,
  },
];

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
          <p className="mt-2 text-sm text-[#64748b]">Takes 60 seconds. Choose your membership level and get started.</p>
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
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
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

            {/* Journey */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#94a3b8] mb-3">
                Which journey interests you most? <span className="text-[#c9993a]">*</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: "business", label: "Know Your Business", sub: "Grow and scale your enterprise" },
                  { value: "personal", label: "Know Yourself", sub: "Leadership and personal growth" },
                  { value: "both", label: "Both", sub: "All of the above" },
                ].map((j, i) => (
                  <label key={j.value} className="flex cursor-pointer items-start gap-3 rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-4 transition hover:border-[#a07830] has-[:checked]:border-[#a07830] has-[:checked]:bg-[#fdf6ec]">
                    <input defaultChecked={i === 0} name="journey" type="radio" value={j.value} className="mt-0.5 h-4 w-4 accent-[#a07830]" />
                    <span>
                      <span className="block text-sm font-bold text-[#0c1e3a]">{j.label}</span>
                      <span className="block text-xs text-[#64748b] mt-0.5">{j.sub}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Membership tier */}
          <div className="rounded-xl border border-[#e8e3db] bg-white p-8 shadow-sm">
            <h2 className="font-serif text-lg font-bold text-[#0c1e3a] mb-1">Choose Your Membership</h2>
            <p className="text-sm text-[#64748b] mb-6">You can start free and upgrade anytime. Paid membership payment will be arranged by our team.</p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map((tier, i) => (
                <label key={tier.value} className={`relative flex cursor-pointer flex-col rounded border px-5 py-5 transition has-[:checked]:ring-2 has-[:checked]:ring-[#a07830] ${tier.highlight ? "border-[#a07830] bg-[#fdf6ec]" : "border-[#e8e3db] bg-[#faf8f5] hover:border-[#a07830]"}`}>
                  {tier.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#a07830] px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white">Popular</span>
                  )}
                  <input defaultChecked={i === 0} name="membershipTier" type="radio" value={tier.value} className="sr-only" />
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#a07830] mb-2">{tier.label}</span>
                  <span className="font-serif text-2xl font-bold text-[#0c1e3a]">{tier.price}<span className="text-sm font-normal text-[#64748b]">{tier.period}</span></span>
                  <span className="mt-1 text-xs text-[#64748b] mb-4">{tier.description}</span>
                  <ul className="space-y-1.5">
                    {tier.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-1.5 text-xs text-[#64748b]">
                        <span className="mt-0.5 text-[#a07830]">✓</span>{perk}
                      </li>
                    ))}
                  </ul>
                </label>
              ))}
            </div>

            <p className="mt-5 text-xs text-[#94a3b8]">
              Selecting a paid tier reserves your spot. Our team will contact you at <strong>{email}</strong> to complete payment.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded bg-[#0c1e3a] px-6 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#1a3358]"
          >
            Join WCCC — Access My Dashboard →
          </button>

          <p className="text-center text-xs text-[#94a3b8]">
            By joining you agree to our{" "}
            <a href="#" className="underline hover:text-[#0c1e3a]">Terms of Use</a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-[#0c1e3a]">Privacy Policy</a>.
          </p>
        </form>
      </div>
    </main>
  );
}
