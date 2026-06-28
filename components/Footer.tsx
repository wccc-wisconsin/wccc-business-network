const quickLinks = [
  { label: "About WCCC", href: "#" },
  { label: "Membership", href: "/login" },
  { label: "Programs", href: "#programs" },
  { label: "Events", href: "#events" },
  { label: "Partners", href: "#partners" },
  { label: "Dashboard", href: "/dashboard" },
];

const socialLinks = [
  { label: "Facebook", href: "https://facebook.com/wisccc", icon: "f" },
  { label: "LinkedIn", href: "https://linkedin.com/company/wisccc", icon: "in" },
  { label: "Instagram", href: "https://instagram.com/wisccc", icon: "ig" },
  { label: "YouTube", href: "https://youtube.com/@wisccc", icon: "yt" },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050d1a] px-6 pt-16 pb-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-3 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d7a84d] font-serif text-lg font-bold text-[#050d1a] glow-gold">
                W
              </span>
              <div>
                <div className="font-serif text-lg font-bold text-white">WCCC</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#38bdf8]">Business Network</div>
              </div>
            </div>
            <p className="text-sm leading-7 text-white/45 max-w-xs">
              Wisconsin Chinese Chamber of Commerce — empowering entrepreneurs,
              professionals, and partners across Wisconsin since 2017.
            </p>
            <div className="mt-5 flex gap-3">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[10px] font-bold text-white/40 transition hover:border-[#d7a84d]/40 hover:text-[#d7a84d]"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-white/30 mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-white/50 transition hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-white/30 mb-4">Contact</h3>
            <ul className="space-y-3 text-sm text-white/50">
              <li>
                <span className="block text-white/30 text-[10px] uppercase tracking-widest mb-0.5">Email</span>
                info@wisccc.org
              </li>
              <li>
                <span className="block text-white/30 text-[10px] uppercase tracking-widest mb-0.5">Location</span>
                Madison, Wisconsin
              </li>
              <li>
                <span className="block text-white/30 text-[10px] uppercase tracking-widest mb-0.5">Membership</span>
                <a href="/login" className="text-[#d7a84d] hover:text-[#f1c864] transition">Join or Sign In</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.05] pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-white/25">
          <span>© {new Date().getFullYear()} Wisconsin Chinese Chamber of Commerce. All rights reserved.</span>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white/50 transition">Privacy</a>
            <a href="#" className="hover:text-white/50 transition">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
