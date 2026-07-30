"use client";

import { useEffect } from "react";
import Link from "next/link";

// Catches anything thrown while rendering a route below app/. Must be a client
// component — that's a Next.js requirement for error boundaries, since it needs
// the reset() handler on the client.
//
// The error's message is deliberately NOT rendered: these can carry database
// details or stack context, and this page is shown to members. The digest is
// shown instead, which is the id Next.js also writes to the server logs, so a
// member can quote it and someone can find the matching entry.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error rendering a page:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#faf8f5] px-6 text-center text-[#0c1e3a]">
      <div className="flex items-center gap-4">
        <div className="h-px w-10 bg-[#c9993a]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#a07830]">
          Something went wrong
        </span>
        <div className="h-px w-10 bg-[#c9993a]" />
      </div>

      <h1 className="mt-6 font-serif text-4xl font-bold lg:text-5xl">
        This page didn&apos;t load
      </h1>

      <p className="mt-4 max-w-md text-sm leading-7 text-[#64748b]">
        Something broke on our end, not yours. Trying again usually works — your saved
        progress isn&apos;t affected.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-navy">
          Try again
        </button>
        <Link href="/" className="btn-gold-outline">
          Back to home
        </Link>
      </div>

      {error.digest && (
        <p className="mt-10 text-xs text-[#94a3b8]">
          Reference code: <span className="font-mono">{error.digest}</span>
        </p>
      )}

      <p className="mt-2 text-xs text-[#94a3b8]">
        If it keeps happening, email{" "}
        <a href="mailto:info@wisccc.org" className="text-[#a07830] hover:text-[#0c1e3a]">
          info@wisccc.org
        </a>
      </p>
    </main>
  );
}
