import { getCurrentMember } from "@/lib/appStore";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Events", href: "#events" },
  { label: "Programs", href: "#programs" },
  { label: "Partners", href: "#partners" },
];

export default async function Header() {
  const member = await getCurrentMember();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07172b]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <a href="#top" className="flex items-center gap-4" aria-label="WCCC home">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-[#d7a84d] font-serif text-2xl font-bold text-[#07172b]">
            W
          </span>
          <span>
            <span className="block font-serif text-2xl font-bold leading-none text-white">
              WCCC
            </span>
            <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-[#f1c864]">
              Business Network
            </span>
          </span>
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-6 text-xs font-bold uppercase tracking-[0.16em] text-white/72 lg:flex"
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="transition hover:text-[#f1c864]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <a
            href="#programs"
            className="rounded-full border border-white/15 px-4 py-2 font-semibold text-white/80 transition hover:border-[#d7a84d] hover:text-white"
          >
            Explore
          </a>
          <a
            href={member ? "/dashboard" : "/login"}
            className="rounded-full bg-[#d7a84d] px-4 py-2 font-bold text-[#07172b] transition hover:bg-[#f1c864]"
          >
            {member ? "Dashboard" : "Sign in"}
          </a>
        </div>
      </div>
    </header>
  );
}
