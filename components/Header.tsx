import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

const navItems = [
  { label: "Events", href: "#events" },
  { label: "Programs", href: "#programs" },
  { label: "Partners", href: "#partners" },
  { label: "Dashboard", href: "/dashboard" },
];

export default async function Header() {
  const { userId } = await auth();

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-[#e8e3db]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="#top" className="flex items-center gap-3" aria-label="WCCC home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wccc-logo.jpg" alt="WCCC logo" className="h-10 w-10 rounded-full object-cover" />
          <span className="hidden sm:block">
            <span className="block font-serif text-lg font-bold leading-none tracking-tight text-[#0c1e3a]">WCCC</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.3em] text-[#a07830]">
              Wisconsin's Diverse Chamber — Rooted in Asian-American Heritage
            </span>
          </span>
        </a>

        {/* Nav */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748b] transition hover:text-[#0c1e3a]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {userId ? (
            <div className="flex items-center gap-3">
              <a href="/dashboard" className="btn-navy">Dashboard</a>
              <UserButton />
            </div>
          ) : (
            <>
              <a href="/login" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b] transition hover:text-[#0c1e3a]">
                Sign In
              </a>
              <a href="/login" className="btn-navy">Join WCCC</a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
