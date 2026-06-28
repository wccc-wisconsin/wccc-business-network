const socialLinks = [
  { label: "Facebook", href: "https://facebook.com/wisccc", icon: "f" },
  { label: "LinkedIn", href: "https://linkedin.com/company/wisccc", icon: "in" },
  { label: "Instagram", href: "https://instagram.com/wisccc", icon: "ig" },
  { label: "YouTube", href: "https://youtube.com/@wisccc", icon: "yt" },
];

const footerLinks = [
  { label: "About Us", href: "#" },
  { label: "Programs", href: "#programs" },
  { label: "Events", href: "#events" },
  { label: "Business Directory", href: "#" },
  { label: "Become a Member", href: "/login" },
  { label: "Contact", href: "mailto:info@wisccc.org" },
];

export default function Footer() {
  return (
    <footer className="bg-[#061426] border-t border-white/10 px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#d7a84d] font-serif text-2xl font-bold text-[#07172b]">
                W
              </span>
              <span>
                <span className="block font-serif text-xl font-bold text-white">WCCC</span>
                <span className="block text-xs uppercase tracking-[0.2em] text-[#f1c864]">
                  Business Network
                </span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/60 max-w-xs">
              Empowering small businesses across Wisconsin with programs, mentorship,
              and strategic connections since 2017.
            </p>
            {/* Social icons */}
            <div className="mt-5 flex gap-3">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-xs font-bold text-white/60 transition hover:border-[#d7a84d] hover:text-[#d7a84d]"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#d7a84d]">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-white/60 transition hover:text-[#d7a84d]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#d7a84d]">
              Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-white/60">
              <li>Wisconsin Chinese Chamber of Commerce</li>
              <li>Milwaukee, Wisconsin</li>
              <li>
                <a href="mailto:info@wisccc.org" className="hover:text-[#d7a84d] transition">
                  info@wisccc.org
                </a>
              </li>
              <li>
                <a href="https://wisccc.org" className="hover:text-[#d7a84d] transition">
                  wisccc.org
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
          <span>© {new Date().getFullYear()} Wisconsin Chinese Chamber of Commerce. All rights reserved.</span>
          <span>Built with ❤️ for Wisconsin businesses</span>
        </div>
      </div>
    </footer>
  );
}
