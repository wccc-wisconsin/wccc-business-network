import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0f2d4a] flex items-center justify-center px-6 py-10">
      <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:items-center max-w-5xl w-full">
        <section className="text-white">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
            WCCC member access
          </p>
          <h1 className="mt-4 font-serif text-5xl font-bold leading-tight sm:text-6xl">
            Sign in and keep moving.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/72">
            A practical member hub for entrepreneurs, professionals, and community
            partners building stronger companies and careers.
          </p>
        </section>

        <div>
          <SignIn routing="hash" afterSignInUrl="/dashboard" afterSignUpUrl="/onboarding" />
        </div>
      </div>
    </main>
  );
}
