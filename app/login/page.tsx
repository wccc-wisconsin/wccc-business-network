import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/actions";
import { getCurrentMember } from "@/lib/appStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const member = await getCurrentMember();
  const params = await searchParams;

  if (member) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#07172b] px-6 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <Link
            href="/"
            className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-[#d7a84d] hover:text-white"
          >
            Back to home
          </Link>
          <p className="mt-10 text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
            WCCC member access
          </p>
          <h1 className="mt-4 font-serif text-5xl font-bold leading-tight sm:text-6xl">
            Sign in and keep moving.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/72">
            This local app records member sign-ins, event registrations, and
            program enrollment so the dashboard reflects real activity.
          </p>
        </section>

        <section className="rounded-[8px] border border-[#d7a84d]/30 bg-[#0b2544] p-6 shadow-2xl shadow-black/20">
          <h2 className="font-serif text-3xl font-bold">Member profile</h2>
          <p className="mt-2 text-sm leading-6 text-white/65">
            For this MVP, email creates or reopens a local member record. A
            production release should connect this flow to Supabase, Clerk,
            Auth0, or another identity provider.
          </p>

          {params.error === "missing-fields" ? (
            <div className="mt-5 rounded-[8px] border border-red-300/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
              Name and email are required.
            </div>
          ) : null}

          <form action={signInAction} className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-white/80">Name</span>
              <input
                required
                name="name"
                type="text"
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-white px-4 py-3 text-[#07172b] outline-none ring-[#d7a84d] transition focus:ring-2"
                placeholder="Jane Smith"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-white/80">Email</span>
              <input
                required
                name="email"
                type="email"
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-white px-4 py-3 text-[#07172b] outline-none ring-[#d7a84d] transition focus:ring-2"
                placeholder="jane@example.com"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-white/80">
                Business or organization
              </span>
              <input
                name="businessName"
                type="text"
                className="mt-2 w-full rounded-[8px] border border-white/10 bg-white px-4 py-3 text-[#07172b] outline-none ring-[#d7a84d] transition focus:ring-2"
                placeholder="Smith Studio"
              />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-white/80">
                Primary journey
              </legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-white/12 bg-white/5 px-4 py-3">
                  <input
                    defaultChecked
                    name="journey"
                    type="radio"
                    value="business"
                    className="h-4 w-4 accent-[#d7a84d]"
                  />
                  <span>Know Your Business</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-white/12 bg-white/5 px-4 py-3">
                  <input
                    name="journey"
                    type="radio"
                    value="personal"
                    className="h-4 w-4 accent-[#d7a84d]"
                  />
                  <span>Know Yourself</span>
                </label>
              </div>
            </fieldset>

            <button
              type="submit"
              className="w-full rounded-full bg-[#d7a84d] px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#07172b] transition hover:bg-[#f1c864]"
            >
              Continue to dashboard
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
