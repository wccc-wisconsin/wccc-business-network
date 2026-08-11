import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import MobileNav, { type NavItem } from "@/components/MobileNav";

// Shared by the desktop link row and the mobile disclosure panel, so the two
// can't drift apart.
const navItems: NavItem[] = [
  { label: "Events", href: "#events" },
  { label: "Programs", href: "#programs" },
  { label: "Partners", href: "#partners" },
  { label: "Dashboard", href: "/dashboard" },
];

export default async function Header() {
  const { userId } = await auth();

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-[#e8e3db]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        {/* Logo */}
        <a href="#top" className="flex min-w-0 items-center gap-3" aria-label="WCCC home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wccc-logo.jpg" alt="WCCC logo" className="h-10 w-10 rounded-full object-cover" />
          <span className="hidden sm:block">
            <span className="block font-serif text-lg font-bold leading-none tracking-tight text-[#0c1e3a]">WCCC</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.3em] text-[#a07830]">
              Wisconsin&apos;s Diverse Chamber — Rooted in Asian-American Heritage
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

        {/* Actions. On phones the secondary "Sign In" text link is dropped —
            "Join WCCC" goes to the same page, and two links plus the menu
            button don't fit beside the logo at 360px. */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {userId ? (
            <>
              <a href="/dashboard" className="btn-navy">Dashboard</a>
              <UserButton />
            </>
          ) : (
            <>
              <a href="/login" className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b] transition hover:text-[#0c1e3a] sm:inline">
                Sign In
              </a>
              <a href="/login" className="btn-navy">Join WCCC</a>
            </>
          )}
          <MobileNav items={navItems} />
        </div>
      </div>
    </header>
  );
}
