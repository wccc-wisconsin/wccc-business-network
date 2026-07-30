import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { events } from "@/data/events";
import { recordEventAttendance } from "@/lib/appStore";
import { slugifyEventTitle } from "@/lib/eventSlug";

// Hit by scanning the per-event QR code (see the dashboard's "Event check-in
// codes" section). Whoever scans it, while signed in on their own phone,
// gets marked attended for that event — no form, no extra tap.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ event: string }> },
) {
  const { event: slug } = await params;
  const matchedEvent = events.find((e) => slugifyEventTitle(e.title) === slug);

  const dashboardUrl = new URL("/dashboard", request.url);

  if (!matchedEvent) {
    dashboardUrl.searchParams.set("checkin", "invalid");
    return NextResponse.redirect(dashboardUrl);
  }

  const { userId } = await auth();

  if (!userId) {
    // Not signed in on this device — send to login. Clerk's sign-in here
    // always lands on /dashboard afterward (not back on this link), so
    // the attendee just needs to scan the same QR code again once signed in.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check the result before claiming success. recordEventAttendance returns
  // { ok: false } on a real write failure — most likely a foreign-key
  // violation because this Clerk user has no `members` row yet (signed up but
  // never finished onboarding). Redirecting to checkin=success regardless
  // meant the attendee saw "✓ You're checked in" while nothing was recorded,
  // and staff had no way to notice until the attendance numbers came up short.
  const result = await recordEventAttendance(userId, matchedEvent.title);

  if (!result.ok) {
    dashboardUrl.searchParams.set("checkin", "error");
    dashboardUrl.searchParams.set("event", slug);
    return NextResponse.redirect(dashboardUrl);
  }

  dashboardUrl.searchParams.set("checkin", "success");
  dashboardUrl.searchParams.set("event", slug);
  return NextResponse.redirect(dashboardUrl);
}
