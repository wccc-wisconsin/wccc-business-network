import { hubLinks } from "@/data/hub";

// Public-homepage counterpart to CommunityHubLinks (the signed-in version).
//
// The membership table sells "Community directory" as the free Network tier's
// first perk, but every link to the Hub used to sit behind the login — so a
// visitor could read about the directory and have no way to reach it. This
// puts the directory, events calendar and RFP board in front of signed-out
// visitors, which is also the strongest free thing WCCC has to show them.
//
// Same links as the dashboard version, shared via data/hub.ts; only the
// styling differs, since this sits on the light homepage rather than the dark
// dashboard.
export default function HubHighlights() {
  return (
    <section id="community" className="bg-[#faf8f5] px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-[#e8e3db] pb-6">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.38em] text-[#a07830]">
              Wisconsin Asian Hub
            </p>
            <h2 className="font-serif text-4xl font-bold text-[#0c1e3a]">
              Explore the community
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[#64748b]">
              Browse Asian-owned businesses across Wisconsin, see what&apos;s coming up, and
              track live contract opportunities — no membership required.
            </p>
          </div>
          <a
            href="https://hub.wcccbusinessnetwork.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold-outline"
          >
            Visit the Hub ↗
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hubLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-6"
            >
              <span className="text-3xl">{link.icon}</span>
              <p className="mt-3 text-[15px] font-bold text-[#0c1e3a]">{link.label}</p>
              <p className="mt-1 text-xs leading-6 text-[#64748b]">{link.description}</p>
              <span className="mt-4 inline-block text-[10px] font-bold uppercase tracking-[0.22em] text-[#a07830]">
                Open ↗
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
