import { hubLinks } from "@/data/hub";

// The signed-in view of the Wisconsin Asian Hub links. The link list moved to
// data/hub.ts so the public homepage (components/HubHighlights.tsx) renders
// the same set without a second copy to keep in sync.
export default function CommunityHubLinks() {
  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
        Wisconsin Asian Hub
      </p>
      <h2 className="mt-1 font-serif text-2xl font-bold text-white">More from the WCCC community</h2>
      <p className="mt-1 text-sm text-white/50">
        The Hub is WCCC&apos;s wider community site — browse it directly for the business directory,
        events, bid opportunities, and member spotlight videos.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {hubLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[8px] border border-white/10 bg-white/5 p-4 transition hover:border-[#d7a84d]/40 hover:bg-white/10"
          >
            <span className="text-2xl">{link.icon}</span>
            <p className="mt-2 text-sm font-bold text-white">{link.label}</p>
            <p className="mt-1 text-xs leading-5 text-white/55">{link.description}</p>
            <span className="mt-3 inline-block text-xs font-bold uppercase tracking-[0.15em] text-[#d7a84d]">
              Visit the Hub ↗
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
