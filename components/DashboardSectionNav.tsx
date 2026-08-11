"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DashboardSection = {
  /** Must match the `id` on the corresponding wrapper in app/dashboard/page.tsx. */
  id: string;
  label: string;
};

/**
 * Sticky jump-nav for the dashboard's stacked panels.
 *
 * The dashboard is ten full-width panels deep (welcome → snapshot → roadmap →
 * coach → decisions → funding → community → events → programs → activity). A
 * member who signs in to check one deadline had to scroll past all of it, and
 * on a phone that's most of a minute of thumb work. This strip pins to the top
 * of the viewport once the header scrolls away and lets them jump straight
 * there.
 *
 * Deliberately plain `<a href="#id">` links rather than JS-driven scrolling:
 * anchors work before hydration and with JS disabled, and the browser handles
 * the offset itself via `scroll-padding-top` on <html> (see globals.css). The
 * only thing this component adds on top is the active-state highlight, which
 * is pure progressive enhancement — if it never runs, the nav still navigates.
 *
 * Sections whose ids aren't in the DOM are skipped by the scroll-spy rather
 * than treated as position 0, so a caller passing a section that's
 * conditionally rendered can't strand the highlight on it.
 */

/**
 * Distance below the viewport top that counts as "you are here". Sits just
 * under the strip's own height so the section you're reading is the one
 * highlighted, not the one whose heading is hidden behind the strip.
 */
const ACTIVE_LINE_PX = 120;

/** Treat "within this many px of the page bottom" as the last section. */
const BOTTOM_EPSILON_PX = 4;

type Props = {
  sections: DashboardSection[];
};

export default function DashboardSectionNav({ sections }: Props) {
  const [activeId, setActiveId] = useState<string>("");
  const stripRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Which section is under the "you are here" line.
  //
  // Uses a scroll listener with a rAF gate rather than IntersectionObserver on
  // purpose: an observer needs a root margin band, and any band tall enough to
  // be stable is also tall enough that the last (short) section at the bottom
  // of the page can never enter it — the highlight sticks one section early
  // and never reaches the end. Measuring ~10 rects on a rAF tick is cheap and
  // has no such blind spot.
  const recomputeActive = useCallback(() => {
    let current = "";

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= ACTIVE_LINE_PX) current = section.id;
      // First present section wins before the page is scrolled at all.
      if (!current) current = section.id;
    }

    // The final panel is usually shorter than the viewport, so its top never
    // crosses the line — without this the last chip could never light up.
    const atBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - BOTTOM_EPSILON_PX;
    if (atBottom) {
      for (let i = sections.length - 1; i >= 0; i--) {
        if (document.getElementById(sections[i].id)) {
          current = sections[i].id;
          break;
        }
      }
    }

    setActiveId((prev) => (prev === current ? prev : current));
  }, [sections]);

  useEffect(() => {
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        recomputeActive();
      });
    }

    // Seed the highlight through the same rAF path as a real scroll rather
    // than calling recomputeActive() straight from the effect body: measuring
    // after the browser has laid the page out gives correct rects, and it
    // keeps the initial paint free of a synchronous cascading re-render.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [recomputeActive]);

  // Keep the highlighted chip visible in the horizontally-scrolling strip on
  // narrow screens. Sets `scrollLeft` on the strip directly instead of calling
  // scrollIntoView, which would also be entitled to scroll the page — moving
  // the document out from under a member who is mid-scroll.
  useEffect(() => {
    const strip = stripRef.current;
    const link = activeId ? linkRefs.current[activeId] : null;
    if (!strip || !link) return;

    const linkLeft = link.offsetLeft;
    const linkRight = linkLeft + link.offsetWidth;
    const viewLeft = strip.scrollLeft;
    const viewRight = viewLeft + strip.clientWidth;
    if (linkLeft >= viewLeft && linkRight <= viewRight) return; // already visible

    const target = linkLeft - strip.clientWidth / 2 + link.offsetWidth / 2;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    strip.scrollTo({
      left: Math.max(0, target),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeId]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Dashboard sections"
      // Negative margins cancel the page container's padding so the sticky bar
      // spans the full content width, then the padding is re-applied inside.
      className="sticky top-0 z-30 -mx-4 mb-6 border-b border-white/10 bg-[#0f2d4a]/95 px-4 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <div
        ref={stripRef}
        // `relative` makes the strip the offsetParent the scroll maths above
        // measures each chip against.
        className="no-scrollbar relative flex gap-1.5 overflow-x-auto py-3"
      >
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              ref={(el) => {
                linkRefs.current[section.id] = el;
              }}
              aria-current={isActive ? "true" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition ${
                isActive
                  ? "bg-[#d7a84d] text-[#0f2d4a]"
                  : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              {section.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
