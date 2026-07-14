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

  await recordEventAttendance(userId, matchedEvent.title);

  dashboardUrl.searchParams.set("checkin", "success");
  dashboardUrl.searchParams.set("event", slug);
  return NextResponse.redirect(dashboardUrl);
}
