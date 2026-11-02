"use client";
import { useMemo, useState, type CSSProperties } from "react";
import { Input } from "indas-ui";
import { Cpu, MemoryStick, HardDrive, Server, Clock, Database, AlertTriangle, Search, ChevronDown, ChevronUp } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import type { ServerInfo, ServerDbDetail } from "@/lib/databaseBackup";

const fmtMB = (mb: number | null | undefined) =>
  mb == null ? "—" : mb >= 1024 * 1024 ? `${(mb / 1048576).toFixed(2)} TB` : mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-") : "";

const daysAgo = (s: string | null) => (s ? (Date.now() - new Date(s).getTime()) / 86400000 : Infinity);

const uptime = (s: string | null) => {
  if (!s) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 60000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Green < 75% · amber < 90% · red ≥ 90%.
const usageColor = (pct: number) => (pct >= 90 ? "#dc2626" : pct >= 75 ? "#d97706" : "#16a34a");

type SortKey = "total" | "data" | "log" | "name" | "backup";
const PAGE = 15;

interface Props {
  info: ServerInfo | null;
  loading: boolean;
  error: string;
  selectedDb: string;
  onSelectDb: (name: string) => void;
}

export default function ServerInfoPanel({ info, loading, error, selectedDb, onSelectDb }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("total");
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (info?.databases ?? []).filter((d) => !q || d.name.toLowerCase().includes(q));
    const by: Record<SortKey, (a: ServerDbDetail, b: ServerDbDetail) => number> = {
      total: (a, b) => b.dataMB + b.logMB - (a.dataMB + a.logMB),
      data: (a, b) => b.dataMB - a.dataMB,
      log: (a, b) => b.logMB - a.logMB,
      name: (a, b) => a.name.localeCompare(b.name),
      backup: (a, b) => daysAgo(b.lastBackup) - daysAgo(a.lastBackup),
    };
    return [...list].sort(by[sort]);
  }, [info, query, sort]);

  if (loading) return <div style={panel}><BrandedLoader size="sm" text="Reading server details…" /></div>;
  if (error) {
    return (
      <div style={{ ...panel, display: "flex", alignItems: "center", gap: 8, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
        <AlertTriangle size={16} /> {error}
      </div>
    );
  }
  if (!info) return null;

  const totalData = info.databases.reduce((s, d) => s + d.dataMB, 0);
  const totalLog = info.databases.reduce((s, d) => s + d.logMB, 0);
  const ramUsedPct = info.ramMB && info.ramFreeMB != null ? Math.round(100 * (info.ramMB - info.ramFreeMB) / info.ramMB) : null;
  const fullDrives = info.drives.filter((d) => d.totalMB && (d.totalMB - d.freeMB) / d.totalMB >= 0.9);
  const visible = showAll ? rows : rows.slice(0, PAGE);

  return (
    <div style={panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: "rgb(var(--fg-default))" }}>
          <Server size={18} /> Server Info
          {info.serverName && <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>({info.serverName})</span>}
        </div>
        <span style={{ fontSize: 12, color: "rgb(var(--fg-muted))" }}>
          {info.version}{info.productLevel ? ` ${info.productLevel}` : ""} · {info.edition ?? ""} · v{info.productVersion}
        </span>
      </div>

      {fullDrives.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: "rgba(220,38,38,.08)", color: "#b91c1c", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          <AlertTriangle size={16} />
          {fullDrives.map((d) => d.drive).join(", ")} {fullDrives.length > 1 ? "are" : "is"} over 90% full — new databases or backups may fail.
        </div>
      )}

      {/* Summary tiles */}
      <div style={tileGrid}>
        <Tile icon={Cpu} label="CPU" value={info.cpuCount != null ? `${info.cpuCount} cores` : "—"} />
        <Tile icon={MemoryStick} label="RAM" value={fmtMB(info.ramMB)}
          sub={ramUsedPct != null ? `${ramUsedPct}% in use · SQL ${fmtMB(info.sqlMemoryMB)}` : undefined}
          pct={ramUsedPct ?? undefined} />
        <Tile icon={Database} label="Databases" value={String(info.databases.length)}
          sub={`Data ${fmtMB(totalData)} · Log ${fmtMB(totalLog)}`} />
        <Tile icon={Clock} label="SQL running for" value={uptime(info.startTime)}
          sub={info.startTime ? `Since ${new Date(info.startTime).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : undefined} />
      </div>

      {/* Drives */}
      <div style={sectionTitle}><HardDrive size={15} /> Drives</div>
      {info.drives.length === 0 ? (
        <div style={{ fontSize: 13, color: "rgb(var(--fg-muted))", marginBottom: 16 }}>No drive details available for this login.</div>
      ) : (
        <div style={{ ...tileGrid, marginBottom: 18 }}>
          {info.drives.map((d) => {
            const pct = d.totalMB ? Math.round(100 * (d.totalMB - d.freeMB) / d.totalMB) : null;
            return (
              <div key={d.drive} style={tile}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "rgb(var(--fg-default))" }}>
                    {d.drive} {d.label && <span style={{ fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>{d.label}</span>}
                  </span>
                  {pct != null && <span style={{ fontSize: 15, fontWeight: 800, color: usageColor(pct) }}>{pct}%</span>}
                </div>
                {pct != null && <Bar pct={pct} />}
                <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 6 }}>
                  {d.totalMB
                    ? <><b style={{ color: "rgb(var(--fg-default))" }}>{fmtMB(d.freeMB)}</b> free of {fmtMB(d.totalMB)} · {fmtMB(d.totalMB - d.freeMB)} used</>
                    : <><b style={{ color: "rgb(var(--fg-default))" }}>{fmtMB(d.freeMB)}</b> free (total size not available)</>}
                </div>
                <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 2 }}>
                  {d.dbCount > 0 ? `${d.dbCount} database${d.dbCount > 1 ? "s" : ""} on this drive` : "No database files"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Databases */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ ...sectionTitle, marginBottom: 0 }}><Database size={15} /> Databases ({rows.length})</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, width: 240, maxWidth: "100%" }}>
          <Search size={15} style={{ color: "rgb(var(--fg-muted))", flexShrink: 0 }} />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search database" autoComplete="off" />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginBottom: 8 }}>Click a database to back it up.</div>
      <div style={{ overflowX: "auto", border: "1px solid rgb(var(--border-default))", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr style={{ background: "rgb(var(--bg-muted, 241 245 249))" }}>
              <Th label="Database" k="name" sort={sort} setSort={setSort} />
              <Th label="Data" k="data" sort={sort} setSort={setSort} right />
              <Th label="Log" k="log" sort={sort} setSort={setSort} right />
              <Th label="Total" k="total" sort={sort} setSort={setSort} right />
              <th style={th}>Drive</th>
              <th style={th}>Recovery</th>
              <Th label="Last Full Backup" k="backup" sort={sort} setSort={setSort} />
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => {
              const age = daysAgo(d.lastBackup);
              const isSel = d.name === selectedDb;
              const offline = d.state !== "ONLINE";
              return (
                <tr key={d.name} onClick={() => !offline && onSelectDb(d.name)}
                  title={offline ? `Database is ${d.state}` : "Click to back up this database"}
                  style={{ cursor: offline ? "default" : "pointer", borderTop: "1px solid rgb(var(--border-default))", background: isSel ? "rgb(var(--color-primary) / 0.08)" : undefined }}>
                  <td style={{ ...td, fontWeight: 600, color: "rgb(var(--fg-default))" }}>
                    {d.name}
                    {offline && <span style={{ marginLeft: 6, fontSize: 11, color: "#dc2626" }}>{d.state}</span>}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtMB(d.dataMB)}</td>
                  <td style={{ ...td, textAlign: "right", color: d.logMB > d.dataMB && d.logMB > 1024 ? "#dc2626" : undefined, fontWeight: d.logMB > d.dataMB && d.logMB > 1024 ? 700 : undefined }}
                    title={d.logMB > d.dataMB && d.logMB > 1024 ? "Log file is bigger than the data file" : undefined}>
                    {fmtMB(d.logMB)}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtMB(d.dataMB + d.logMB)}</td>
                  <td style={td}>{d.drives || "—"}</td>
                  <td style={td}>{d.recovery}</td>
                  <td style={{ ...td, color: age === Infinity ? "#dc2626" : age > 7 ? "#d97706" : undefined }}>
                    {d.lastBackup ? fmtDate(d.lastBackup) : "Never"}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "rgb(var(--fg-muted))", padding: 18 }}>No databases found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE && (
        <button type="button" onClick={() => setShowAll((v) => !v)} style={linkBtn}>
          {showAll ? <>Show less <ChevronUp size={14} /></> : <>Show all {rows.length} databases <ChevronDown size={14} /></>}
        </button>
      )}

      {info.warnings.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#b45309" }}>
          {info.warnings.map((w) => <div key={w}>• {w}</div>)}
        </div>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, pct }: { icon: typeof Cpu; label: string; value: string; sub?: string; pct?: number }) {
  return (
    <div style={tile}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))" }}>
        <Icon size={14} /> {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "rgb(var(--fg-default))", marginTop: 4 }}>{value}</div>
      {pct != null && <Bar pct={pct} />}
      {sub && <div style={{ fontSize: 12, color: "rgb(var(--fg-muted))", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 8, borderRadius: 999, background: "rgb(var(--bg-muted, 229 231 235))", overflow: "hidden", marginTop: 8 }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 999, background: usageColor(pct) }} />
    </div>
  );
}

function Th({ label, k, sort, setSort, right }: { label: string; k: SortKey; sort: SortKey; setSort: (k: SortKey) => void; right?: boolean }) {
  return (
    <th style={{ ...th, textAlign: right ? "right" : "left", cursor: "pointer", userSelect: "none", color: sort === k ? "rgb(var(--color-primary))" : th.color }}
      onClick={() => setSort(k)}>
      {label}{sort === k ? " ▾" : ""}
    </th>
  );
}

const panel: CSSProperties = {
  maxWidth: 1100, margin: "26px auto 0", background: "rgb(var(--bg-surface))", border: "1px solid rgb(var(--border-default))",
  borderRadius: 16, padding: 22, boxShadow: "0 4px 20px -12px rgba(0,0,0,.25)",
};
const tileGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 18 };
const tile: CSSProperties = { border: "1px solid rgb(var(--border-default))", borderRadius: 12, padding: "12px 14px", background: "rgb(var(--bg-surface))" };
const sectionTitle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 10 };
const th: CSSProperties = { padding: "9px 12px", fontSize: 12, fontWeight: 700, color: "#334155", textAlign: "left", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 12px", whiteSpace: "nowrap", color: "rgb(var(--fg-default))" };
const linkBtn: CSSProperties = {
  marginTop: 10, border: "none", background: "transparent", color: "rgb(var(--color-primary))", fontWeight: 600, fontSize: 13,
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, padding: 0,
};
