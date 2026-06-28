import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Events", href: "#events" },
  { label: "Programs", href: "#programs" },
  { label: "Partners", href: "#partners" },
];

export default async function Header() {
  const { userId } = await auth();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <a href="#top" className="flex items-center gap-4" aria-label="WCCC home">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#d7a84d] font-serif text-xl font-bold text-white glow-gold">
            W
          </span>
          <span>
            <span className="block font-serif text-xl font-bold leading-none text-[#0f1e35]">WCCC</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#38bdf8]">
              Business Network
            </span>
          </span>
        </a>

        <nav aria-label="Primary navigation" className="hidden items-center gap-7 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 lg:flex">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-[#0f1e35]">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <a href="#programs" className="rounded-full border border-slate-200 px-4 py-2 font-semibold text-slate-500 transition hover:border-slate-400 hover:text-[#0f1e35]">
            Explore
          </a>
          {userId ? (
            <div className="flex items-center gap-3">
              <a href="/dashboard" className="rounded-full bg-[#d7a84d] px-4 py-2 font-bold text-white transition hover:bg-[#c4953a]">
                Dashboard
              </a>
              <UserButton />
            </div>
          ) : (
            <a href="/login" className="rounded-full bg-[#d7a84d] px-4 py-2 font-bold text-white transition hover:bg-[#c4953a]">
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
