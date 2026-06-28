import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "wccc_session";

export type JourneyType = "business" | "personal";

export type Member = {
  id: string;
  email: string;
  name: string;
  businessName: string;
  journey: JourneyType;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

export type Session = {
  id: string;
  memberId: string;
  createdAt: string;
  expiresAt: string;
};

export type LoginEvent = {
  id: string;
  memberId: string;
  email: string;
  at: string;
  userAgent: string;
};

export type EventRegistration = {
  id: string;
  memberId: string;
  eventTitle: string;
  createdAt: string;
};

export type ProgramEnrollment = {
  id: string;
  memberId: string;
  programTitle: string;
  createdAt: string;
};

export type MemberActivity = {
  id: string;
  memberId: string;
  type: "login" | "event" | "program" | "profile";
  title: string;
  detail: string;
  createdAt: string;
};

export type AppStore = {
  members: Member[];
  sessions: Session[];
  loginEvents: LoginEvent[];
  eventRegistrations: EventRegistration[];
  programEnrollments: ProgramEnrollment[];
  activities: MemberActivity[];
};

export type MemberDashboard = {
  registrations: EventRegistration[];
  enrollments: ProgramEnrollment[];
  loginEvents: LoginEvent[];
  activities: MemberActivity[];
  progress: number;
};

type SignInInput = {
  email: string;
  name: string;
  businessName: string;
  journey: JourneyType;
  userAgent: string;
};

const emptyStore: AppStore = {
  members: [],
  sessions: [],
  loginEvents: [],
  eventRegistrations: [],
  programEnrollments: [],
  activities: [],
};

function getStorePath() {
  return path.join(process.cwd(), "storage", "app-store.json");
}

function now() {
  return new Date().toISOString();
}

function thirtyDaysFromNow() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sortNewestFirst<T extends { createdAt?: string; at?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const left = a.createdAt ?? a.at ?? "";
    const right = b.createdAt ?? b.at ?? "";
    return right.localeCompare(left);
  });
}

async function readStore(): Promise<AppStore> {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    return { ...emptyStore, ...JSON.parse(raw) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...emptyStore };
    }

    throw error;
  }
}

async function writeStore(store: AppStore) {
  const storePath = getStorePath();
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

async function getSessionIdFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function signInMember(input: SignInInput) {
  const store = await readStore();
  const email = normalizeEmail(input.email);
  const timestamp = now();
  let member = store.members.find((item) => item.email === email);

  if (!member) {
    member = {
      id: randomUUID(),
      email,
      name: input.name.trim(),
      businessName: input.businessName.trim(),
      journey: input.journey,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: timestamp,
    };
    store.members.push(member);
  } else {
    member.name = input.name.trim() || member.name;
    member.businessName = input.businessName.trim() || member.businessName;
    member.journey = input.journey;
    member.updatedAt = timestamp;
    member.lastLoginAt = timestamp;
  }

  const session: Session = {
    id: randomUUID(),
    memberId: member.id,
    createdAt: timestamp,
    expiresAt: thirtyDaysFromNow(),
  };

  store.sessions.push(session);
  store.loginEvents.push({
    id: randomUUID(),
    memberId: member.id,
    email: member.email,
    at: timestamp,
    userAgent: input.userAgent,
  });
  store.activities.push({
    id: randomUUID(),
    memberId: member.id,
    type: "login",
    title: "Signed in",
    detail: "Member session started",
    createdAt: timestamp,
  });

  await writeStore(store);

  return { member, session };
}

export async function getCurrentMember() {
  const sessionId = await getSessionIdFromCookie();

  if (!sessionId) {
    return null;
  }

  const store = await readStore();
  const session = store.sessions.find((item) => item.id === sessionId);

  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return store.members.find((member) => member.id === session.memberId) ?? null;
}

export async function endCurrentSession() {
  const sessionId = await getSessionIdFromCookie();

  if (!sessionId) {
    return;
  }

  const store = await readStore();
  store.sessions = store.sessions.filter((session) => session.id !== sessionId);
  await writeStore(store);
}

export async function getMemberDashboard(memberId: string): Promise<MemberDashboard> {
  const store = await readStore();
  const registrations = store.eventRegistrations.filter(
    (registration) => registration.memberId === memberId,
  );
  const enrollments = store.programEnrollments.filter(
    (enrollment) => enrollment.memberId === memberId,
  );
  const loginEvents = store.loginEvents.filter((event) => event.memberId === memberId);
  const activities = store.activities.filter((activity) => activity.memberId === memberId);
  const progress = Math.min(
    100,
    25 + registrations.length * 15 + enrollments.length * 18,
  );

  return {
    registrations: sortNewestFirst(registrations),
    enrollments: sortNewestFirst(enrollments),
    loginEvents: sortNewestFirst(loginEvents),
    activities: sortNewestFirst(activities).slice(0, 8),
    progress,
  };
}

export async function registerForEvent(memberId: string, eventTitle: string) {
  const store = await readStore();
  const timestamp = now();
  const exists = store.eventRegistrations.some(
    (registration) =>
      registration.memberId === memberId && registration.eventTitle === eventTitle,
  );

  if (!exists) {
    store.eventRegistrations.push({
      id: randomUUID(),
      memberId,
      eventTitle,
      createdAt: timestamp,
    });
    store.activities.push({
      id: randomUUID(),
      memberId,
      type: "event",
      title: "Registered for event",
      detail: eventTitle,
      createdAt: timestamp,
    });
    await writeStore(store);
  }
}

export async function enrollInProgram(memberId: string, programTitle: string) {
  const store = await readStore();
  const timestamp = now();
  const exists = store.programEnrollments.some(
    (enrollment) =>
      enrollment.memberId === memberId && enrollment.programTitle === programTitle,
  );

  if (!exists) {
    store.programEnrollments.push({
      id: randomUUID(),
      memberId,
      programTitle,
      createdAt: timestamp,
    });
    store.activities.push({
      id: randomUUID(),
      memberId,
      type: "program",
      title: "Joined program",
      detail: programTitle,
      createdAt: timestamp,
    });
    await writeStore(store);
  }
}
