"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, MapPin, Briefcase, Calendar, IdCard, LogOut, BadgeCheck } from "lucide-react";
import { getEmployee, clearEmployee, type Employee } from "@/lib/employee";

function initials(name?: string | null) {
  const p = (name || "?").trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: React.ReactNode }) {
  const empty = value == null || value === "" || value === "—";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "1px solid #f1f4f8" }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: "#eef3fa", color: "rgb(var(--fg-muted))", display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.1, color: "rgb(var(--fg-muted))", width: 128, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: empty ? "#c2cad4" : "#16202e", wordBreak: "break-word" }}>{empty ? "—" : value}</span>
    </div>
  );
}

export default function EmployeePage() {
  const router = useRouter();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const e = getEmployee();
    if (!e) { router.replace("/login"); return; }
    setEmp(e); setReady(true);
  }, [router]);

  function logout() { clearEmployee(); router.replace("/login"); }

  if (!ready || !emp) return null;

  return (
    <div style={{ minHeight: "100vh", background: "rgb(var(--bg-subtle))" }}>
      {/* top bar */}
      <div style={{ background: "linear-gradient(100deg,color-mix(in srgb, rgb(var(--color-primary)) 78%, black),rgb(var(--color-primary)))", color: "#fff", padding: "14px 22px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>360</div>
        <div style={{ fontSize: 15.5, fontWeight: 800 }}>Indus Command Center <span style={{ opacity: 0.6, fontWeight: 600, fontSize: 13 }}>· Employee Portal</span></div>
        <button onClick={logout} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.24)", color: "#fff", borderRadius: 10, padding: "8px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <LogOut size={15} /> Logout
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "26px 20px 40px" }}>
        {/* profile header card */}
        <div style={{ background: "rgb(var(--bg-surface))", borderRadius: 18, border: "1px solid #e7ecf3", boxShadow: "0 12px 32px -20px rgba(16,24,40,.22)", padding: "26px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ width: 78, height: 78, borderRadius: 20, background: "linear-gradient(135deg,rgb(var(--color-primary)),color-mix(in srgb, rgb(var(--color-primary)) 45%, white))", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 30, flexShrink: 0, boxShadow: "0 10px 22px -8px rgba(31,69,118,.6)" }}>
            {initials(emp.fullName)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 23, fontWeight: 800, color: "rgb(var(--fg-default))", margin: 0 }}>{emp.fullName || "Employee"}</h1>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#1c8a4a", background: "#e6f6ec", border: "1px solid #b7e2c6", borderRadius: 999, padding: "3px 10px" }}>
                <BadgeCheck size={13} /> {emp.status || "Active"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "rgb(var(--fg-default))", fontFamily: "monospace", background: "rgb(var(--bg-subtle))", border: "1px solid #e6edf6", borderRadius: 8, padding: "3px 10px" }}>
                <IdCard size={13} /> {emp.employeeCode || "No code"}
              </span>
              {emp.employeeType && <span style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", fontWeight: 600 }}>{emp.employeeType}</span>}
            </div>
          </div>
        </div>

        {/* welcome banner */}
        <div style={{ marginTop: 16, background: "linear-gradient(120deg,#eaf3fb,#f4f8fd)", border: "1px solid #d9e7f5", borderRadius: 14, padding: "14px 18px", fontSize: 14, color: "#2c4a6b" }}>
          👋 Welcome back, <b>{(emp.fullName || "").split(" ")[0] || "there"}</b>! You’re signed in successfully.
        </div>

        {/* details */}
        <div style={{ marginTop: 16, background: "rgb(var(--bg-surface))", borderRadius: 16, border: "1px solid #e7ecf3", boxShadow: "0 12px 32px -22px rgba(16,24,40,.2)", overflow: "hidden" }}>
          <div style={{ padding: "13px 18px", borderBottom: "1px solid #eef1f5", fontSize: 14, fontWeight: 700, color: "rgb(var(--fg-default))", background: "linear-gradient(180deg,#fbfcfe,#fff)" }}>My Details</div>
          <div style={{ padding: "6px 18px 12px" }}>
            <Row icon={<Mail size={15} />} label="Work Email" value={emp.email} />
            <Row icon={<Mail size={15} />} label="Personal Email" value={emp.personalEmail} />
            <Row icon={<Phone size={15} />} label="Phone" value={emp.phoneNumber} />
            <Row icon={<MapPin size={15} />} label="Work Location" value={emp.workLocation} />
            <Row icon={<Briefcase size={15} />} label="Employee Type" value={emp.employeeType} />
            <Row icon={<Calendar size={15} />} label="Date of Joining" value={fmtDate(emp.dateOfJoining)} />
          </div>
        </div>
      </div>
    </div>
  );
}
