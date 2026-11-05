// "Training Attendance & Completion Sheet" — printable record for one Training Update row. The trainer
// prints it at the client site, every participant signs against their name, the client's coordinator
// signs, and the signed scan is attached back on the same Training row. One A4 portrait page.

export interface TrainingSheetData {
  clientName?: string | null;
  venue?: string | null;
  modules?: string | null;      // comma-joined Main Module(s)
  scheduleDate?: string | null; // yyyy-MM-dd
  startTime?: string | null;    // HH:mm (24h)
  endTime?: string | null;
  trainees?: string | null;     // comma-joined names
  trainer?: string | null;
  status?: string | null;
  details?: string | null;
  remark?: string | null;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const fmtDate = (v?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  return m ? `${m[3]}-${MON[Number(m[2]) - 1]}-${m[1]}` : (v || "");
};
const fmtTime = (v?: string | null) => {
  const m = /^(\d{2}):(\d{2})$/.exec(v || "");
  if (!m) return v || "";
  const H = Number(m[1]);
  return `${String(H % 12 || 12).padStart(2, "0")}:${m[2]} ${H >= 12 ? "PM" : "AM"}`;
};
const duration = (a?: string | null, b?: string | null) => {
  const p = (t?: string | null) => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const x = p(a), y = p(b);
  if (x === null || y === null || y <= x) return "";
  const mins = y - x, h = Math.floor(mins / 60), mm = mins % 60;
  return `${h ? `${h} hr${h > 1 ? "s" : ""}` : ""}${h && mm ? " " : ""}${mm ? `${mm} min` : ""}`;
};
const split = (v?: string | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function trainingSheetHtml(d: TrainingSheetData, logoUrl: string): string {
  const modules = split(d.modules);
  const trainees = split(d.trainees);
  const rowCount = Math.max(1, trainees.length);   // one row per trainee entered on the form (1 blank row if none)
  const start = fmtTime(d.startTime), end = fmtTime(d.endTime), dur = duration(d.startTime, d.endTime);
  const now = new Date();
  const printedOn = `${String(now.getDate()).padStart(2, "0")}-${MON[now.getMonth()]}-${now.getFullYear()}`;
  const box = (on: boolean) => `<span class="cb${on ? " on" : ""}">${on ? "&#10003;" : ""}</span>`;
  const st = (d.status || "").toLowerCase();

  const rows = Array.from({ length: rowCount }, (_, i) => `<tr>
      <td class="c n">${i + 1}</td>
      <td class="name">${esc(trainees[i] ?? "")}</td>
      <td></td><td></td><td></td>
    </tr>`).join("");

  const field = (label: string, value: string) =>
    `<div class="f"><div class="fl">${label}</div><div class="fv">${value || "&nbsp;"}</div></div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Training Sheet ${esc(d.clientName)} ${esc(fmtDate(d.scheduleDate))}</title>
<style>
  /* margin:0 → the browser drops its own header/footer (URL, title, page no.); the sheet pads itself */
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: "Segoe UI", Calibri, Arial, sans-serif; color: #1e293b; font-size: 10.5px; line-height: 1.35;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 296mm; padding: 11mm 12mm 9mm; display: flex; flex-direction: column;
          /* a long sheet runs onto page 2: repeat the page padding there too (no text on the paper edge) */
          box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  /* Long sheets (many participants / long topics) flow onto a 2nd page — but never split a section:
     a section title stays with its content, a block moves whole to the next page, table rows never split
     and the attendance header repeats. Sign-off (both boxes) always prints as one block. */
  .keep { break-inside: avoid; page-break-inside: avoid; }
  .sec { break-after: avoid; page-break-after: avoid; }
  .att tr { break-inside: avoid; page-break-inside: avoid; }
  .att thead { display: table-header-group; }
  :root { --brand: #0f766e; --ink: #0f172a; --line: #cbd5e1; --soft: #f1f5f9; --head: #0b4f6c; }

  /* header */
  .top { display: flex; align-items: center; justify-content: space-between; }
  .logo { width: 150px; height: 60px; object-fit: cover; object-position: center; margin-left: -8px; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; font-size: 17px; color: var(--ink); letter-spacing: .3px; text-transform: uppercase; }
  .doc .sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .ref { display: inline-flex; gap: 14px; margin-top: 5px; font-size: 9.5px; color: #475569; }
  .ref b { color: var(--ink); }
  .bar { height: 4px; margin: 7px 0 10px; background: linear-gradient(90deg, var(--brand) 0 62%, #06b6d4 62% 78%, #d946ef 78% 89%, #facc15 89%); border-radius: 2px; }

  /* section titles */
  .sec { display: flex; align-items: center; gap: 7px; margin: 10px 0 5px; font-size: 10.5px; font-weight: 700; color: var(--head); text-transform: uppercase; letter-spacing: .6px; }
  .sec .num { width: 17px; height: 17px; border-radius: 50%; background: var(--head); color: #fff; display: grid; place-items: center; font-size: 9.5px; }
  .sec::after { content: ""; flex: 1; height: 1px; background: var(--line); }

  /* detail fields */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .f { display: grid; grid-template-columns: 112px 1fr; border-bottom: 1px solid var(--line); }
  .f:nth-child(odd) { border-right: 1px solid var(--line); }
  .grid2 .f:nth-last-child(-n+2) { border-bottom: none; }
  .fl { background: var(--soft); padding: 6px 8px; font-weight: 600; color: #475569; }
  .fv { padding: 6px 8px; color: var(--ink); font-weight: 600; }
  .muted { color: #64748b; font-weight: 400; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { border: 1px solid #99d5cf; background: #ecfdf9; color: #115e59; border-radius: 10px; padding: 1px 8px; font-weight: 600; font-size: 9.5px; }
  .text { border: 1px solid var(--line); border-radius: 6px; padding: 7px 9px; min-height: 34px; white-space: pre-wrap; color: var(--ink); }

  /* attendance */
  table { width: 100%; border-collapse: collapse; }
  .att th { background: var(--head); color: #fff; font-weight: 600; font-size: 10px; padding: 6px 7px; text-align: left; border: 1px solid var(--head); }
  .att td { border: 1px solid var(--line); height: 29px; padding: 0 7px; }
  .att tbody tr:nth-child(even) td { background: #f8fafc; }
  .att .c { text-align: center; }
  .att .n { color: #64748b; width: 34px; }
  .att .name { font-weight: 600; color: var(--ink); }

  /* status / feedback */
  .opts { display: grid; grid-template-columns: 1.15fr 1fr; gap: 0; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .opt { padding: 7px 9px; }
  .opt + .opt { border-left: 1px solid var(--line); }
  .opt .t { font-weight: 700; color: #475569; margin-bottom: 5px; }
  .opt label { display: inline-flex; align-items: center; gap: 4px; margin-right: 10px; white-space: nowrap; }
  .cb { width: 11px; height: 11px; border: 1.2px solid #475569; border-radius: 2px; display: inline-grid; place-items: center; font-size: 9px; line-height: 1; }
  .cb.on { background: var(--brand); border-color: var(--brand); color: #fff; }
  .lines { border: 1px solid var(--line); border-radius: 6px; padding: 2px 9px 6px; }
  .lines div { border-bottom: 1px dotted #94a3b8; height: 21px; }
  .lines .pre { border-bottom: none; height: auto; padding-top: 5px; color: var(--ink); }

  /* sign-off */
  .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .sg { border: 1px solid var(--line); border-radius: 6px; padding: 7px 9px 6px; display: flex; flex-direction: column; }
  .sg .t { font-weight: 700; color: var(--head); text-transform: uppercase; font-size: 9.5px; letter-spacing: .5px; }
  .sg .space { flex: 1; min-height: 38px; }
  .sg .row { display: flex; justify-content: space-between; border-top: 1px solid #94a3b8; padding-top: 3px; font-size: 9.5px; color: #475569; }
  .sg .who { font-size: 9.5px; color: #475569; margin-top: 2px; }

  .foot { margin-top: auto; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; }

  @media screen { body { background: #e2e8f0; } .page { background: #fff; margin: 18px auto; box-shadow: 0 6px 24px rgba(0,0,0,.14); } }
</style></head>
<body><div class="page">
  <div class="top">
    <img class="logo" src="${esc(logoUrl)}" alt="Indas Analytics" />
    <div class="doc">
      <h1>Training Attendance &amp; Completion Sheet</h1>
      <div class="sub">Implementation Programme · Client Site Training Record</div>
      <div class="ref"><span>Date: <b>${esc(fmtDate(d.scheduleDate))}</b></span></div>
    </div>
  </div>
  <div class="bar"></div>

  <div class="keep"><div class="sec"><span class="num">1</span>Training Details</div>
  <div class="grid2">
    ${field("Client / Company", esc(d.clientName))}
    ${field("Venue", esc(d.venue))}
    ${field("Indas Trainer", esc(d.trainer))}
    ${field("Training Date", esc(fmtDate(d.scheduleDate)))}
    ${field("Module(s) Covered", modules.length ? `<span class="chips">${modules.map((m) => `<span class="chip">${esc(m)}</span>`).join("")}</span>` : "")}
    ${field("Training Time", `${esc(start)}${end ? ` – ${esc(end)}` : ""}${dur ? ` <span class="muted">(${dur})</span>` : ""}`)}
  </div></div>

  <div class="sec"><span class="num">2</span>Topics Covered</div>
  <div class="text">${esc(d.details) || "&nbsp;"}</div>

  <div class="sec"><span class="num">3</span>Participants' Attendance</div>
  <table class="att">
    <thead><tr>
      <th class="c" style="width:34px">S.No.</th>
      <th style="width:30%">Participant Name</th>
      <th style="width:23%">Designation / Department</th>
      <th style="width:17%">Contact No.</th>
      <th>Signature</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="keep"><div class="sec"><span class="num">4</span>Training Status &amp; Client Feedback</div>
  <div class="opts">
    <div class="opt"><div class="t">Training Status</div>
      <label>${box(st === "complete")} Completed</label><label>${box(st === "running")} Partially Completed</label><label>${box(st === "hold")} On Hold</label><label>${box(false)} Rescheduled</label>
    </div>
    <div class="opt"><div class="t">Overall Rating</div>
      <label>${box(false)} Excellent</label><label>${box(false)} Good</label><label>${box(false)} Average</label><label>${box(false)} Needs Improvement</label>
    </div>
  </div></div>

  <div class="keep"><div class="sec"><span class="num">5</span>Comments / Pending Points (if any)</div>
  <div class="lines">${d.remark ? `<div class="pre">${esc(d.remark)}</div>` : ""}<div></div><div></div></div></div>

  <div class="keep">
  <div class="signs">
    <div class="sg"><div class="t">Indas Trainer</div><div class="who">${esc(d.trainer)}</div><div class="space"></div><div class="row"><span>Signature</span><span>Date: ____________</span></div></div>
    <div class="sg"><div class="t">Client Authorised Signatory</div><div class="who">Name: ______________________</div><div class="space"></div><div class="row"><span>Signature &amp; Designation</span><span>Date: ____________</span></div></div>
  </div></div>

  <div class="foot">
    <span>Indas Analytics Pvt. Ltd. · Print Process Automation Partner · This signed sheet confirms the training delivered.</span>
    <span>Printed ${printedOn}</span>
  </div>
</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body></html>`;
}

/**
 * Opens the sheet in its own tab and starts the print dialog there. It is loaded from a Blob URL with
 * "noopener" so the new tab runs in a SEPARATE browsing context: a document.write()-ed about:blank tab
 * shares the app tab's event loop, and its open print dialog froze the Tracker screen.
 */
export function printTrainingSheet(d: TrainingSheetData): boolean {
  const html = trainingSheetHtml(d, `${window.location.origin}/app/company-logo.png`);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;   // noopener always returns null, so a blocked pop-up can't be detected here
}
