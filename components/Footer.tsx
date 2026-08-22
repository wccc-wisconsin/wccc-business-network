// Every entry here must resolve to a real page or a real on-page anchor.
// "About WCCC" used to sit at the top of this list pointing at href="#",
// which silently jumped to the top of the page instead of going anywhere.
// It's out until there's an /about page to point it at.
// "Programs" (#programs) and "Events" (#events) were removed for the same
// reason: both sections were built from placeholder content and no longer
// exist, so the links would have jumped nowhere. Real WCCC events are on the
// Wisconsin Asian Hub, which "Events" now points at directly.
const quickLinks = [
  { label: "Membership", href: "/login" },
  { label: "Pathways", href: "#journeys" },
  { label: "Events", href: "https://hub.wcccbusinessnetwork.org/events" },
  { label: "Partners", href: "#partners" },
  { label: "Dashboard", href: "/dashboard" },
];

// Taken from WCCC Connect's footer (wccc-platform), the organisation's public
// site, so both properties point at the same accounts.
//
// The YouTube URL here used to be youtube.com/@wisccc, which was a guess at the
// handle rather than the real channel — WCCC's actual channel is
// @wisconsinchinesechamberofc914. A dead social link in a footer costs nothing
// to fix and looks careless left in.
const socialLinks = [
  { label: "Facebook", href: "https://facebook.com/wisccc", icon: "f" },
  { label: "LinkedIn", href: "https://linkedin.com/company/wisccc", icon: "in" },
  { label: "Instagram", href: "https://instagram.com/wisccc", icon: "ig" },
  { label: "X", href: "https://twitter.com/wisccc", icon: "x" },
  { label: "YouTube", href: "https://www.youtube.com/@wisconsinchinesechamberofc914", icon: "yt" },
];

export default function Footer() {
  return (
    <footer className="bg-[#faf8f5] border-t border-[#e8e3db] px-4 pt-12 pb-8 sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-3 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wccc-logo.jpg" alt="WCCC logo" className="h-9 w-9 rounded-full object-cover" />
              <div>
                <div className="font-serif text-base font-bold text-[#0c1e3a]">WCCC</div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#a07830]">Wisconsin&apos;s Diverse Chamber</div>
              </div>
            </div>
            <p className="text-sm leading-7 text-[#64748b] max-w-xs">
              Wisconsin Chinese Chamber of Commerce — a diverse chamber rooted in
              Asian-American heritage, open to all. Est. 2017.
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
              {quickLinks.map((l) => {
                // One of these now leaves the site (the Hub events calendar),
                // so off-site links get the new tab and the rel that stops the
                // opened page reaching back through window.opener.
                const isExternal = l.href.startsWith("http");
                return (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      className="text-sm text-[#64748b] transition hover:text-[#0c1e3a]"
                    >
                      {l.label}
                      {isExternal && " ↗"}
                    </a>
                  </li>
                );
              })}
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
          {/* Privacy Policy and Terms of Use links lived here pointing at
              href="#". Rather than show links that go nowhere, they're removed
              until the actual policy pages exist — at which point add them back
              here pointing at /privacy and /terms. */}
          <a href="mailto:info@wisccc.org" className="hover:text-[#64748b] transition">
            info@wisccc.org
          </a>
        </div>
      </div>
    </footer>
  );
}
