// Onsite Dashboard logic: who is at which client, who is free, what needs attention. No UI in here.
// Days are whole numbers (days since 1970, UTC), so date maths is never off by a timezone hour.

export interface OnsiteVisitLike {
  id: number; clientCode: string; person: string; status?: string | null; fromDate?: string | null; toDate?: string | null;
}
// "ongoing" = the status Onsite (formerly Ongoing, so old rows read the same).
export type OnsiteKind = "ongoing" | "planned" | "complete" | "office";
export type PersonState = "onsite" | "office" | "free" | "unlisted";

/** A visit with parsed days. `end` = the last day to draw/occupy, `plannedEnd` = the To Date as entered. */
export interface OnsiteSpan<V extends OnsiteVisitLike = OnsiteVisitLike> {
  visit: V; personKey: string; kind: OnsiteKind; from: number; end: number; plannedEnd: number | null; overdueDays: number;
}
export interface OnsitePerson<V extends OnsiteVisitLike = OnsiteVisitLike> {
  key: string; name: string; designation?: string | null; state: PersonState; listed: boolean;
  spans: OnsiteSpan<V>[]; current: OnsiteSpan<V>[]; next: OnsiteSpan<V> | null; lastEnd: number | null;
}
export type AttentionKind = "overdue" | "notStarted" | "notClosed" | "earlyStart" | "doubleBooked" | "noDates";
export interface OnsiteAttention<V extends OnsiteVisitLike = OnsiteVisitLike> { kind: AttentionKind; personKey: string; visit: V; other?: V; days?: number }
export interface OnsiteBoard<V extends OnsiteVisitLike = OnsiteVisitLike> {
  persons: OnsitePerson<V>[]; attention: OnsiteAttention<V>[]; startingSoon: OnsiteSpan<V>[]; returningSoon: OnsiteSpan<V>[];
}

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const personKeyOf = (name?: string | null) => (name ?? "").trim().toLowerCase();

/** "2026-11-04…" or "04-11-2026" / "04/11/2026" → day number; null when blank or not a real date. */
export function parseDay(value?: string | null): number | null {
  const s = (value ?? "").trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (dmy) { d = +dmy[1]; m = +dmy[2]; y = +dmy[3]; }
  else return null;
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}

/** The device's calendar date as a day number. */
export function todayDay(now: Date = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;
}

export const dayToDate = (day: number) => new Date(day * DAY_MS);
export function formatDay(day: number, withYear = true): string {
  const d = dayToDate(day);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
}
export const monthLabel = (day: number) => { const d = dayToDate(day); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

export function kindOf(status?: string | null): OnsiteKind {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "complete" || s === "completed") return "complete";
  if (s === "office") return "office";
  if (s === "planned") return "planned";
  return "ongoing";
}

/**
 * Dates → a drawable span. No From Date: the To Date stands in; neither: null (can't be placed).
 * Onsite / Office with no To Date stay open up to today. An Onsite visit past its To Date is still
 * on site as far as the status says, so it runs on to today and counts as overdue.
 */
export function toSpan<V extends OnsiteVisitLike>(visit: V, today: number): OnsiteSpan<V> | null {
  const rawFrom = parseDay(visit.fromDate), rawTo = parseDay(visit.toDate);
  const from = rawFrom ?? rawTo;
  if (from === null) return null;
  const kind = kindOf(visit.status);
  const plannedEnd = rawTo !== null && rawTo >= from ? rawTo : null;
  const openEnded = kind === "ongoing" || kind === "office";
  let end = plannedEnd ?? (openEnded ? Math.max(from, today) : from);
  let overdueDays = 0;
  if (kind === "ongoing" && plannedEnd !== null && plannedEnd < today) {
    overdueDays = today - plannedEnd;
    end = today;
  }
  return { visit, personKey: personKeyOf(visit.person), kind, from, end, plannedEnd, overdueDays };
}

const covers = (s: OnsiteSpan, day: number) => s.from <= day && day <= s.end;
const isClientVisit = (s: OnsiteSpan) => s.kind === "ongoing" || s.kind === "planned";
const stateRank: Record<PersonState, number> = { onsite: 0, office: 1, free: 2, unlisted: 3 };

/**
 * The whole picture for one day. `roster` = the users ticked as Onsite Person: only they can be "free".
 * Someone with visits who is not on the roster still shows while on site, otherwise as "unlisted".
 */
export function buildOnsiteBoard<V extends OnsiteVisitLike>(
  visits: V[], roster: { name: string; designation?: string | null }[], today: number, soonDays = 7,
): OnsiteBoard<V> {
  const attention: OnsiteAttention<V>[] = [];
  const byPerson = new Map<string, OnsitePerson<V>>();
  const ensure = (name: string, listed: boolean, designation?: string | null) => {
    const key = personKeyOf(name);
    let p = byPerson.get(key);
    if (!p) {
      p = { key, name: name.trim(), designation, state: "free", listed, spans: [], current: [], next: null, lastEnd: null };
      byPerson.set(key, p);
    }
    return p;
  };
  for (const r of roster) if (personKeyOf(r.name)) ensure(r.name, true, r.designation);

  const spans: OnsiteSpan<V>[] = [];
  for (const v of visits) {
    if (!personKeyOf(v.person)) continue;
    const s = toSpan(v, today);
    if (!s) {
      if (kindOf(v.status) !== "complete") attention.push({ kind: "noDates", personKey: personKeyOf(v.person), visit: v });
      continue;
    }
    spans.push(s);
    ensure(v.person, false).spans.push(s);
  }

  for (const p of byPerson.values()) {
    p.spans.sort((a, b) => a.from - b.from || a.end - b.end);
    p.current = p.spans.filter((s) => isClientVisit(s) && covers(s, today));
    p.next = p.spans.find((s) => isClientVisit(s) && s.from > today) ?? null;
    // Last day at a client before today. A Complete visit is over whatever its To Date says (it may have ended early).
    const past = p.spans.filter((s) => s.kind !== "office" && s.from <= today && (s.kind === "complete" || s.end < today));
    p.lastEnd = past.length ? Math.max(...past.map((s) => Math.min(s.end, today - 1))) : null;
    const inOffice = p.spans.some((s) => s.kind === "office" && covers(s, today));
    p.state = p.current.length ? "onsite" : inOffice ? "office" : p.listed ? "free" : "unlisted";

    for (const s of p.spans) {
      if (s.overdueDays > 0) attention.push({ kind: "overdue", personKey: p.key, visit: s.visit, days: s.overdueDays });
      else if (s.kind === "planned" && s.end < today) attention.push({ kind: "notClosed", personKey: p.key, visit: s.visit, days: today - s.end });
      else if (s.kind === "planned" && s.from <= today) attention.push({ kind: "notStarted", personKey: p.key, visit: s.visit, days: today - s.from });
      else if (s.kind === "ongoing" && s.from > today) attention.push({ kind: "earlyStart", personKey: p.key, visit: s.visit, days: s.from - today });
    }
    // Two live visits on the same days. Past clashes are history, so only those still running or ahead.
    const live = p.spans.filter((s) => isClientVisit(s) && s.end >= today);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      if (live[i].from <= live[j].end && live[j].from <= live[i].end) {
        attention.push({ kind: "doubleBooked", personKey: p.key, visit: live[i].visit, other: live[j].visit });
      }
    }
  }

  const persons = [...byPerson.values()].sort((a, b) => stateRank[a.state] - stateRank[b.state] || a.name.localeCompare(b.name));
  return {
    persons, attention,
    startingSoon: spans.filter((s) => isClientVisit(s) && s.from > today && s.from <= today + soonDays).sort((a, b) => a.from - b.from),
    returningSoon: spans.filter((s) => isClientVisit(s) && covers(s, today) && !s.overdueDays && s.plannedEnd !== null && s.plannedEnd <= today + soonDays).sort((a, b) => a.end - b.end),
  };
}

/**
 * The dashboard only covers people ticked as Onsite Person. Returns their visits, plus the names of
 * unticked people with a visit that isn't Complete, so a live visit is reported rather than silently dropped.
 */
export function splitByRoster<V extends OnsiteVisitLike>(visits: V[], roster: { name: string }[]): { listed: V[]; hiddenNames: string[] } {
  const keys = new Set(roster.map((r) => personKeyOf(r.name)));
  const hidden = new Map<string, string>();
  const listed = visits.filter((v) => {
    const key = personKeyOf(v.person);
    if (keys.has(key)) return true;
    if (key && kindOf(v.status) !== "complete" && !hidden.has(key)) hidden.set(key, v.person.trim());
    return false;
  });
  return { listed, hiddenNames: [...hidden.values()].sort((a, b) => a.localeCompare(b)) };
}

/** Stack overlapping bars: each span gets the first lane free at its start. */
export function assignLanes<T extends { from: number; end: number }>(items: T[]): { lanes: number; placed: { item: T; lane: number }[] } {
  const laneEnds: number[] = [];
  const placed = [...items].sort((a, b) => a.from - b.from || a.end - b.end).map((item) => {
    let lane = laneEnds.findIndex((end) => end < item.from);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(item.end); } else laneEnds[lane] = item.end;
    return { item, lane };
  });
  return { lanes: Math.max(1, laneEnds.length), placed };
}
