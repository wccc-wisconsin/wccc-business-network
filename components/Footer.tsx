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
    <footer className="bg-[#faf8f5] border-t border-[#e8e3db] px-6 pt-16 pb-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-3 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wccc-logo.jpg" alt="WCCC logo" className="h-9 w-9 rounded-full object-cover" />
              <div>
                <div className="font-serif text-base font-bold text-[#0c1e3a]">WCCC</div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#a07830]">Community &amp; Growth Network</div>
              </div>
            </div>
            <p className="text-sm leading-7 text-[#64748b] max-w-xs">
              Wisconsin Chinese Chamber of Commerce — growing people, building businesses,
              and strengthening community across Wisconsin since 2017.
            </p>
            <div className="mt-5 flex gap-2">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-8 w-8 items-center justify-center rounded border border-[#e8e3db] text-[10px] font-bold text-[#94a3b8] transition hover:border-[#a07830] hover:text-[#a07830]"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#94a3b8] mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-[#64748b] transition hover:text-[#0c1e3a]">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#94a3b8] mb-4">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <span className="block text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-0.5">Email</span>
                <span className="text-[#64748b]">info@wisccc.org</span>
              </li>
              <li>
                <span className="block text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-0.5">Location</span>
                <span className="text-[#64748b]">Madison, Wisconsin</span>
              </li>
              <li>
                <span className="block text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-0.5">Membership</span>
                <a href="/login" className="text-[#a07830] hover:text-[#0c1e3a] transition">Join or Sign In</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#e8e3db] pt-6 flex flex-wrap items-center justify-between gap-4 text-[11px] text-[#94a3b8]">
          <span>© {new Date().getFullYear()} Wisconsin Chinese Chamber of Commerce. All rights reserved.</span>
          <div className="flex gap-5">
            <a href="#" className="hover:text-[#64748b] transition">Privacy Policy</a>
            <a href="#" className="hover:text-[#64748b] transition">Terms of Use</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
