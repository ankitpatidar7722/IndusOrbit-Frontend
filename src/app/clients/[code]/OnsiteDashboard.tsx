"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { StandardModal } from "indas-ui";
import { AlertTriangle, Building2, CalendarClock, ChevronLeft, ChevronRight, LogOut as ReturnIcon, MapPin, RefreshCw, Search, UserCheck, Users } from "lucide-react";
import type { OnsiteVisit } from "@/lib/api";
import { usersApi } from "@/lib/users";
import {
  assignLanes, buildOnsiteBoard, dayToDate, formatDay, monthLabel, parseDay, splitByRoster, todayDay,
  type OnsiteAttention, type OnsiteKind, type OnsitePerson, type OnsiteSpan, type PersonState,
} from "@/lib/onsiteTimeline";

type Span = OnsiteSpan<OnsiteVisit>;
type Person = OnsitePerson<OnsiteVisit>;
type TileId = "onsite" | "free" | "office" | "starting" | "returning" | "attention";

const ONSITE_PERMISSION = "onsite.person";
const OTHER_CLIENT = "Another client";
const LANE_H = 30;

const KIND_COLOR: Record<OnsiteKind, string> = { ongoing: "#2563eb", planned: "#7c3aed", complete: "#16a34a", office: "#ea580c" };
const KIND_LABEL: Record<OnsiteKind, string> = { ongoing: "Onsite", planned: "Planned", complete: "Complete", office: "Office" };
const OVERDUE_COLOR = "#dc2626";
const STATE_CHIP: Record<PersonState, { label: string; color: string }> = {
  onsite: { label: "On Site", color: "#2563eb" },
  office: { label: "In Office", color: "#ea580c" },
  free: { label: "Free", color: "#16a34a" },
  unlisted: { label: "Not Listed", color: "#64748b" },
};
const ZOOMS = [
  { id: "2w", label: "2 Weeks", days: 14, px: 44, lead: 3 },
  { id: "month", label: "Month", days: 30, px: 30, lead: 7 },
  { id: "quarter", label: "3 Months", days: 90, px: 13, lead: 14 },
] as const;
type ZoomId = (typeof ZOOMS)[number]["id"];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Gantt-style view of Onsite Management: who is at which client since when, and who is free. */
export default function OnsiteDashboard({ visits, clientName, onRefresh }: {
  /** Every visit, including clients this user can't see: a person busy there must not look free. */
  visits: OnsiteVisit[];
  clientName: (code?: string | null) => string | null;
  onRefresh: () => void | Promise<void>;
}) {
  const [today] = useState(() => todayDay());
  const [roster, setRoster] = useState<{ name: string; designation?: string | null }[]>([]);
  const [rosterState, setRosterState] = useState<"loading" | "ready" | "error">("loading");
  const [zoom, setZoom] = useState<ZoomId>("month");
  const [offset, setOffset] = useState(0);
  const [groupBy, setGroupBy] = useState<"person" | "client">("person");
  const [query, setQuery] = useState("");
  const [tile, setTile] = useState<TileId | null>(null);
  const [selected, setSelected] = useState<Span | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Roster = active users ticked as "Onsite Person" in User Management.
  useEffect(() => {
    let live = true;
    Promise.all([usersApi.usersWithPermission(ONSITE_PERMISSION), usersApi.list()])
      .then(([granted, users]) => {
        if (!live) return;
        if (!granted.success || !users.success) { setRosterState("error"); return; }
        const ids = new Set(granted.data);
        setRoster(users.data.filter((u) => u.isActive && u.fullName?.trim() && ids.has(u.userId)).map((u) => ({ name: u.fullName, designation: u.role })));
        setRosterState("ready");
      })
      .catch(() => { if (live) setRosterState("error"); });
    return () => { live = false; };
  }, []);

  // Only ticked people. If the tick list could not be loaded, show every visit (with the error notice) rather than none.
  const { listed, hiddenNames } = useMemo(
    () => (rosterState === "ready" ? splitByRoster(visits, roster) : { listed: visits, hiddenNames: [] as string[] }),
    [visits, roster, rosterState],
  );
  const board = useMemo(() => buildOnsiteBoard(listed, roster, today), [listed, roster, today]);
  const nameOf = (code?: string | null) => clientName(code) ?? OTHER_CLIENT;

  const byState = (s: PersonState) => board.persons.filter((p) => p.state === s);
  const onsite = byState("onsite"), free = byState("free"), office = byState("office");
  const tileKeys = useMemo<Record<TileId, Set<string>>>(() => ({
    onsite: new Set(board.persons.filter((p) => p.state === "onsite").map((p) => p.key)),
    free: new Set(board.persons.filter((p) => p.state === "free").map((p) => p.key)),
    office: new Set(board.persons.filter((p) => p.state === "office").map((p) => p.key)),
    starting: new Set(board.startingSoon.map((s) => s.personKey)),
    returning: new Set(board.returningSoon.map((s) => s.personKey)),
    attention: new Set(board.attention.map((a) => a.personKey)),
  }), [board]);

  // Chart window
  const z = ZOOMS.find((x) => x.id === zoom) ?? ZOOMS[1];
  const winStart = today - z.lead + offset * z.days;
  const winEnd = winStart + z.days - 1;
  const days = useMemo(() => Array.from({ length: z.days }, (_, i) => winStart + i), [winStart, z.days]);
  const months = useMemo(() => {
    const out: { label: string; count: number }[] = [];
    for (const d of days) {
      const label = monthLabel(d);
      if (out.length && out[out.length - 1].label === label) out[out.length - 1].count++;
      else out.push({ label, count: 1 });
    }
    return out;
  }, [days]);

  // On a narrow screen the chart scrolls sideways: start with today next to the name column.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, (today - winStart - 1) * z.px);
  }, [today, winStart, z.px, rosterState]);

  const q = query.trim().toLowerCase();
  const inWindow = (s: Span) => s.from <= winEnd && s.end >= winStart;
  const matchesTile = (key: string) => !tile || tileKeys[tile].has(key);

  // Chart rows: one per person, or one per client.
  const chartRows = useMemo(() => {
    if (groupBy === "person") {
      return board.persons
        .filter((p) => matchesTile(p.key))
        // Someone not ticked as Onsite Person only earns a row when they have a bar to show.
        .filter((p) => p.listed || p.state === "onsite" || p.state === "office" || p.spans.some(inWindow))
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.spans.some((s) => nameOf(s.visit.clientCode).toLowerCase().includes(q)))
        .map((p) => ({ key: p.key, title: p.name, sub: p.designation ?? p.spans[p.spans.length - 1]?.visit.designation ?? "", state: p.state as PersonState | null, spans: p.spans.filter(inWindow), barLabel: (s: Span) => nameOf(s.visit.clientCode) }));
    }
    const groups = new Map<string, Span[]>();
    for (const p of board.persons) {
      if (!matchesTile(p.key)) continue;
      for (const s of p.spans.filter(inWindow)) {
        const name = nameOf(s.visit.clientCode);
        if (q && !name.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) continue;
        groups.set(name, [...(groups.get(name) ?? []), s]);
      }
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, spans]) => ({
      key: name, title: name, sub: plural(new Set(spans.map((s) => s.personKey)).size, "person").replace("persons", "people"), state: null as PersonState | null, spans, barLabel: (s: Span) => s.visit.person,
    }));
    // nameOf / inWindow / matchesTile only read the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, groupBy, q, tile, tileKeys, winStart, winEnd, clientName]);

  const refresh = async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } };

  const tiles: { id: TileId; label: string; value: number; hint: string; color: string; icon: ReactNode }[] = [
    { id: "onsite", label: "On Site Today", value: onsite.length, hint: "At a client right now", color: "#2563eb", icon: <MapPin size={18} /> },
    { id: "free", label: "Free Today", value: free.length, hint: "Can be sent to a client", color: "#16a34a", icon: <UserCheck size={18} /> },
    { id: "office", label: "In Office", value: office.length, hint: "Status set to Office", color: "#ea580c", icon: <Building2 size={18} /> },
    { id: "starting", label: "Leaving Soon", value: board.startingSoon.length, hint: "Visits starting in 7 days", color: "#7c3aed", icon: <CalendarClock size={18} /> },
    { id: "returning", label: "Returning Soon", value: board.returningSoon.length, hint: "Visits ending in 7 days", color: "#0891b2", icon: <ReturnIcon size={18} /> },
    { id: "attention", label: "Needs Attention", value: board.attention.length, hint: "Status or dates look wrong", color: "#dc2626", icon: <AlertTriangle size={18} /> },
  ];

  const available = [...free, ...office];

  if (rosterState === "loading") return <div style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>Loading…</div>;

  return (
    <div className="osd" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rosterState === "error" && <Notice color="#dc2626">Could not load the Onsite Person list, so Free Today may be wrong. Use Refresh or reopen this page.</Notice>}
      {rosterState === "ready" && roster.length === 0 && (
        <Notice color="#b45309">No one is marked as Onsite Person yet. Tick it in User Management → User Permissions to see who is free.</Notice>
      )}

      {hiddenNames.length > 0 && (
        <Notice color="#b45309">Not shown because they are not marked as Onsite Person, but they have an open visit: {hiddenNames.join(", ")}.</Notice>
      )}

      {/* Summary tiles double as chart filters. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {tiles.map((t) => {
          const on = tile === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTile(on ? null : t.id)} aria-pressed={on} title={on ? "Show everyone" : `Show only: ${t.label}`}
              style={{ ...card, padding: "12px 14px", textAlign: "left", cursor: "pointer", borderColor: on ? t.color : borderColor, boxShadow: on ? `0 0 0 1px ${t.color}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: t.color }}>
                <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{t.value}</span>{t.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-default))", marginTop: 4 }}>{t.label}</div>
              <div style={{ fontSize: 11.5, color: "rgb(var(--fg-muted))" }}>{t.hint}</div>
            </button>
          );
        })}
      </div>

      {/* Gantt */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 12px", borderBottom: `1px solid ${borderColor}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconBtn label="Earlier" onClick={() => setOffset((o) => o - 1)}><ChevronLeft size={16} /></IconBtn>
            <button type="button" onClick={() => setOffset(0)} style={pill(offset === 0)}>Today</button>
            <IconBtn label="Later" onClick={() => setOffset((o) => o + 1)}><ChevronRight size={16} /></IconBtn>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-default))", whiteSpace: "nowrap" }}>{formatDay(winStart, false)} – {formatDay(winEnd)}</span>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative", flex: "1 1 170px", maxWidth: 260 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgb(var(--fg-muted))" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search person or client" aria-label="Search person or client"
              style={{ width: "100%", height: 32, padding: "0 10px 0 30px", fontSize: 13, borderRadius: 8, border: `1px solid ${borderColor}`, background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {([["person", "By Person"], ["client", "By Client"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setGroupBy(id)} style={pill(groupBy === id)}>{label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {ZOOMS.map((o) => (
              <button key={o.id} type="button" onClick={() => { setZoom(o.id); setOffset(0); }} style={pill(zoom === o.id)}>{o.label}</button>
            ))}
          </div>
          <IconBtn label="Refresh" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "animate-spin" : undefined} /></IconBtn>
        </div>

        <div ref={scrollRef} style={{ overflow: "auto", maxHeight: "65vh", WebkitOverflowScrolling: "touch" }}>
          <div className="osd-chart" style={{ position: "relative", minWidth: `calc(var(--osd-label) + ${z.days * z.px}px)` }}>
            {/* Weekend shading + today line, drawn once behind all rows. */}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "var(--osd-label)", right: 0, display: "flex", pointerEvents: "none" }}>
              {days.map((d) => {
                const wd = dayToDate(d).getUTCDay();
                return <div key={d} style={{ flex: "1 1 0", borderLeft: z.px >= 30 ? `1px solid ${gridColor}` : undefined, background: d === today ? "rgba(37,99,235,.10)" : wd === 0 || wd === 6 ? "rgba(100,116,139,.08)" : undefined }} />;
              })}
              {today >= winStart && today <= winEnd && (
                <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#2563eb", left: `${((today - winStart + 0.5) / z.days) * 100}%` }} />
              )}
            </div>

            <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 3, background: "rgb(var(--bg-surface))", borderBottom: `1px solid ${borderColor}` }}>
              <div style={labelCell}><span style={{ fontSize: 12, fontWeight: 700, color: "rgb(var(--fg-muted))" }}>{groupBy === "person" ? "Person" : "Client"}</span></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex" }}>
                  {months.map((m) => (
                    <div key={m.label} style={{ flex: `${m.count} 1 0`, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", padding: "5px 6px 2px", fontSize: 12, fontWeight: 700, color: "rgb(var(--fg-default))" }}>{m.label}</div>
                  ))}
                </div>
                <div style={{ display: "flex" }}>
                  {days.map((d) => {
                    const date = dayToDate(d);
                    // Too narrow for every day at 3 Months: number the Mondays only.
                    const show = z.px >= 30 || date.getUTCDay() === 1;
                    return (
                      <div key={d} style={{ flex: "1 1 0", minWidth: 0, textAlign: z.px >= 30 ? "center" : "left", padding: "1px 0 5px", fontSize: 11, whiteSpace: "nowrap", overflow: "visible", fontWeight: d === today ? 800 : 500, color: d === today ? "#2563eb" : "rgb(var(--fg-muted))" }}>
                        {show ? date.getUTCDate() : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {chartRows.length === 0 && (
              <div style={{ position: "relative", padding: "28px 16px", textAlign: "center", fontSize: 13, color: "rgb(var(--fg-muted))" }}>
                Nothing to show for this filter and date range.
              </div>
            )}
            {chartRows.map((row) => {
              const { lanes, placed } = assignLanes(row.spans);
              return (
                <div key={row.key} style={{ display: "flex", position: "relative", borderBottom: `1px solid ${gridColor}` }}>
                  <div style={labelCell}>
                    <div style={{ minWidth: 0 }}>
                      <div title={row.title} style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--fg-default))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgb(var(--fg-muted))", minWidth: 0 }}>
                        {row.state && <span style={{ flexShrink: 0, fontWeight: 700, color: STATE_CHIP[row.state].color }}>{STATE_CHIP[row.state].label}</span>}
                        {row.sub && <span className="osd-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.sub}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, position: "relative", height: Math.max(44, lanes * LANE_H + 8) }}>
                    {placed.map(({ item: s, lane }) => {
                      const start = Math.max(s.from, winStart), end = Math.min(s.end, winEnd);
                      const len = end - start + 1;
                      // The days past the To Date turn red.
                      const okDays = s.overdueDays > 0 ? Math.max(0, Math.min(end, s.plannedEnd ?? end) - start + 1) : len;
                      const okPct = (okDays / len) * 100;
                      const color = KIND_COLOR[s.kind];
                      return (
                        <button key={s.visit.id} type="button" onClick={() => setSelected(s)} title={barTitle(s, nameOf(s.visit.clientCode))}
                          style={{
                            position: "absolute", top: 4 + lane * LANE_H, height: LANE_H - 4, left: `calc(${((start - winStart) / z.days) * 100}% + 1px)`, width: `calc(${(len / z.days) * 100}% - 2px)`,
                            minWidth: 8, padding: "0 7px", border: "none", cursor: "pointer", overflow: "hidden", textAlign: "left", whiteSpace: "nowrap", textOverflow: "ellipsis",
                            color: "#fff", fontSize: 11.5, fontWeight: 700,
                            borderRadius: `${s.from < winStart ? 0 : 6}px ${s.end > winEnd ? 0 : 6}px ${s.end > winEnd ? 0 : 6}px ${s.from < winStart ? 0 : 6}px`,
                            background: okPct >= 100 ? color : `linear-gradient(90deg, ${color} ${okPct}%, ${OVERDUE_COLOR} ${okPct}%)`,
                          }}>
                          {row.barLabel(s)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", padding: "8px 12px", borderTop: `1px solid ${borderColor}`, fontSize: 11.5, color: "rgb(var(--fg-muted))" }}>
          {(Object.keys(KIND_COLOR) as OnsiteKind[]).map((k) => <Legend key={k} color={KIND_COLOR[k]} label={KIND_LABEL[k]} />)}
          <Legend color={OVERDUE_COLOR} label="Past To Date" />
          <span>Tap a bar for details.</span>
        </div>
      </div>

      {/* Today's lists */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 12, alignItems: "start" }}>
        <ListCard title="Who Is Where Today" icon={<MapPin size={16} color="#2563eb" />} count={onsite.length} empty="No one is at a client today.">
          {onsite.flatMap((p) => p.current.map((s) => <OnsiteRow key={s.visit.id} person={p} span={s} client={nameOf(s.visit.clientCode)} today={today} onOpen={() => setSelected(s)} />))}
        </ListCard>
        <ListCard title="Free and In Office" icon={<Users size={16} color="#16a34a" />} count={available.length}
          empty={roster.length ? "Everyone is at a client today." : "Tick Onsite Person in User Management to list people here."}>
          {available.map((p) => <FreeRow key={p.key} person={p} nextClient={p.next ? nameOf(p.next.visit.clientCode) : null} today={today} />)}
        </ListCard>
        {board.attention.length > 0 && (
          <ListCard title="Needs Attention" icon={<AlertTriangle size={16} color="#dc2626" />} count={board.attention.length} empty="">
            {board.attention.map((a, i) => <div key={`${a.kind}-${a.visit.id}-${i}`} style={listRow}><AttentionText item={a} nameOf={nameOf} /></div>)}
          </ListCard>
        )}
      </div>

      <StandardModal isOpen={!!selected} onClose={() => setSelected(null)} title="Onsite Visit" size="sm" showFooter={false}>
        {selected && <VisitDetail span={selected} client={nameOf(selected.visit.clientCode)} today={today} />}
      </StandardModal>
    </div>
  );
}

function barTitle(s: Span, client: string) {
  const to = s.plannedEnd !== null ? formatDay(s.plannedEnd) : "No To Date";
  return `${s.visit.person} at ${client}\n${formatDay(s.from)} to ${to}\n${KIND_LABEL[s.kind]}${s.overdueDays ? `, ${plural(s.overdueDays, "day")} past To Date` : ""}`;
}

function OnsiteRow({ person, span, client, today, onOpen }: { person: Person; span: Span; client: string; today: number; onOpen: () => void }) {
  const dayNo = today - span.from + 1;
  const left = span.plannedEnd !== null ? span.plannedEnd - today : null;
  const back = span.overdueDays ? `${plural(span.overdueDays, "day")} past To Date`
    : left === null ? "No To Date"
    : left === 0 ? "Returns today"
    : `Returns in ${plural(left, "day")}`;
  return (
    <button type="button" onClick={onOpen} style={{ ...listRow, width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", font: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13.5, color: "rgb(var(--fg-default))" }}>{person.name}</b>
        <span style={{ fontSize: 12, fontWeight: 700, color: span.overdueDays ? OVERDUE_COLOR : "rgb(var(--fg-muted))" }}>{back}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "rgb(var(--fg-default))" }}>at {client}</div>
      <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))" }}>
        Since {formatDay(span.from)} · Day {dayNo}{span.plannedEnd !== null && !span.overdueDays ? ` of ${span.plannedEnd - span.from + 1}` : ""}
      </div>
    </button>
  );
}

function FreeRow({ person, nextClient, today }: { person: Person; nextClient: string | null; today: number }) {
  const chip = STATE_CHIP[person.state];
  const since = person.lastEnd !== null ? `Free since ${formatDay(person.lastEnd + 1)}` : "No past visit";
  return (
    <div style={listRow}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13.5, color: "rgb(var(--fg-default))" }}>{person.name}</b>
        <span style={{ fontSize: 12, fontWeight: 700, color: chip.color }}>{chip.label}</span>
      </div>
      <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))" }}>
        {person.state === "free" ? since : person.designation || "Office"}
        {" · "}
        {person.next ? `Next: ${nextClient} on ${formatDay(person.next.from, false)} (in ${plural(person.next.from - today, "day")})` : "No visit planned"}
      </div>
    </div>
  );
}

function AttentionText({ item, nameOf }: { item: OnsiteAttention<OnsiteVisit>; nameOf: (code?: string | null) => string }) {
  const v = item.visit, client = nameOf(v.clientCode), days = plural(item.days ?? 0, "day");
  const fromTxt = parseDay(v.fromDate) !== null ? formatDay(parseDay(v.fromDate)!, false) : "";
  const text: Record<OnsiteAttention["kind"], string> = {
    overdue: `still Onsite at ${client}, but the To Date passed ${days} ago. Mark it Complete or extend the To Date.`,
    notStarted: `is Planned at ${client}, but it started on ${fromTxt}. Change the status to Onsite if the visit began.`,
    notClosed: `is still Planned at ${client}, but its dates ended ${days} ago. Mark it Complete or change the dates.`,
    earlyStart: `is marked Onsite at ${client}, but it starts in ${days}. It should be Planned.`,
    doubleBooked: `is booked at ${client} and ${item.other ? nameOf(item.other.clientCode) : ""} on the same days.`,
    noDates: `has a visit at ${client} with no dates, so it is not on the chart.`,
  };
  return <span style={{ fontSize: 12.5, color: "rgb(var(--fg-default))" }}><b>{v.person}</b> {text[item.kind]}</span>;
}

function VisitDetail({ span, client, today }: { span: Span; client: string; today: number }) {
  const v = span.visit;
  const running = span.kind !== "complete" && span.from <= today && today <= span.end;
  const items: [string, string | null | undefined][] = [
    ["Person", v.person], ["Designation", v.designation], ["Client", client], ["Location", v.location], ["Mobile No", v.mobileNo],
    ["From", formatDay(span.from)], ["To", span.plannedEnd !== null ? formatDay(span.plannedEnd) : "Not set"],
    ["Status", KIND_LABEL[span.kind]],
    ["At Client For", running ? `${plural(today - span.from + 1, "day")} so far` : null],
    ["Past To Date", span.overdueDays ? plural(span.overdueDays, "day") : null],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13.5 }}>
      {items.filter(([, val]) => val && String(val).trim()).map(([k, val]) => (
        <div key={k} style={{ display: "contents" }}>
          <span style={{ fontWeight: 600, color: "rgb(var(--fg-muted))" }}>{k}</span>
          <span style={{ color: "rgb(var(--fg-default))", wordBreak: "break-word" }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

function ListCard({ title, icon, count, empty, children }: { title: string; icon: ReactNode; count: number; empty: string; children: ReactNode }) {
  return (
    <div style={{ ...card, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${borderColor}`, fontSize: 13.5, fontWeight: 700, color: "rgb(var(--fg-default))" }}>
        {icon}{title}<span style={{ marginLeft: "auto", fontSize: 12, color: "rgb(var(--fg-muted))" }}>{count}</span>
      </div>
      {count === 0 ? <div style={{ padding: "16px 14px", fontSize: 13, color: "rgb(var(--fg-muted))" }}>{empty}</div> : <div style={{ maxHeight: 340, overflowY: "auto" }}>{children}</div>}
    </div>
  );
}

function Notice({ color, children }: { color: string; children: ReactNode }) {
  return <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", borderRadius: 10, border: `1px solid ${color}55`, background: `${color}12`, color, fontSize: 13, fontWeight: 600 }}><AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /><span>{children}</span></div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />{label}</span>;
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 8, border: `1px solid ${borderColor}`, background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", cursor: "pointer" }}>{children}</button>;
}

const borderColor = "rgb(var(--bd-default, 226 232 240))";
const gridColor = "rgba(100,116,139,.14)";
const card: CSSProperties = { background: "rgb(var(--bg-surface))", border: `1px solid ${borderColor}`, borderRadius: 12 };
const labelCell: CSSProperties = { width: "var(--osd-label)", flexShrink: 0, position: "sticky", left: 0, zIndex: 2, display: "flex", alignItems: "center", padding: "6px 10px", background: "rgb(var(--bg-surface))", borderRight: `1px solid ${borderColor}`, boxSizing: "border-box" };
const listRow: CSSProperties = { display: "block", padding: "9px 14px", borderBottom: `1px solid ${gridColor}`, boxSizing: "border-box" };
const pill = (on: boolean): CSSProperties => ({
  height: 32, padding: "0 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  border: `1px solid ${on ? "rgb(var(--color-primary))" : borderColor}`,
  background: on ? "rgb(var(--color-primary))" : "rgb(var(--bg-surface))", color: on ? "#fff" : "rgb(var(--fg-default))",
});
