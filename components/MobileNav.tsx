"use client";

import { useEffect, useState } from "react";

export type NavItem = { label: string; href: string };

/**
 * The public header's nav for screens below `lg`, where the inline link row is
 * hidden. Without this there was no route to Events, Programs or Partners on a
 * phone at all — only the two buttons in the header's right-hand corner — so
 * the anchors the hero and footer point at were unreachable for the visitors
 * most likely to be on a phone.
 *
 * Deliberately a plain disclosure panel rather than an overlay drawer: it
 * pushes the page down instead of trapping focus, so there's no focus-trap or
 * scroll-lock to get wrong, and the links are ordinary anchors that work the
 * same as the desktop row.
 */
type Props = {
  items: NavItem[];
};

export default function MobileNav({ items }: Props) {
  const [open, setOpen] = useState(false);

  // Close on Escape, matching what the menu button's aria-expanded promises.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 items-center justify-center rounded border border-[#e8e3db] text-[#0c1e3a] transition hover:bg-[#faf8f5]"
      >
        {/* Two glyphs rather than an icon dependency — the header ships no
            other icons and this is the only place one is needed. */}
        <span aria-hidden="true" className="text-lg leading-none">
          {open ? "✕" : "☰"}
        </span>
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full border-b border-[#e8e3db] bg-white shadow-lg"
        >
          <nav aria-label="Main" className="mx-auto flex max-w-7xl flex-col px-4 py-2 sm:px-6">
            {items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-[#f1ede6] py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#0c1e3a] last:border-b-0"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
