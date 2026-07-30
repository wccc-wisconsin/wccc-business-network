import Link from "next/link";

// Shown for any URL that doesn't match a route. Without this, a mistyped or
// stale link renders Next.js's default 404, which looks nothing like the site.
export const metadata = {
  title: "Page not found — WCCC",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#faf8f5] px-6 text-center text-[#0c1e3a]">
      <div className="flex items-center gap-4">
        <div className="h-px w-10 bg-[#c9993a]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#a07830]">
          Error 404
        </span>
        <div className="h-px w-10 bg-[#c9993a]" />
      </div>

      <h1 className="mt-6 font-serif text-4xl font-bold lg:text-5xl">
        We couldn&apos;t find that page
      </h1>

      <p className="mt-4 max-w-md text-sm leading-7 text-[#64748b]">
        The link may be out of date, or the page may have moved. Everything else is still
        where you left it.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-navy">
          Back to home
        </Link>
        <Link href="/dashboard" className="btn-gold-outline">
          My dashboard
        </Link>
      </div>

      <p className="mt-10 text-xs text-[#94a3b8]">
        Still stuck? Email{" "}
        <a href="mailto:info@wisccc.org" className="text-[#a07830] hover:text-[#0c1e3a]">
          info@wisccc.org
        </a>
      </p>
    </main>
  );
}
