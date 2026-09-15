"use client";
import { useMemo, useState } from "react";
import {
  X, Search, BookOpen, LogIn, LayoutDashboard, Compass, MessageSquare, Mail, Bell,
  Settings as SettingsIcon, Users2, UserPlus, FolderKanban, DatabaseBackup, ChevronRight,
  Lightbulb, MousePointerClick, ListChecks, ImageOff, FileSignature, Map, FileSpreadsheet,
  ClipboardCheck, Plane, BookMarked, PackageOpen, Boxes, Images, Trash2, Building2, Layers,
  ShieldCheck, type LucideIcon,
} from "lucide-react";

/**
 * In-app User Manual — opened from the "User Manual" button in the top header. A complete, screenshot-
 * driven guide to the whole application, starting at Login, written so a brand-new user can run the app
 * end to end. Data-driven: each Section lists its screenshots (public/manual/<file>) + numbered callouts
 * ("what each button does") + steps + tips. Missing images fall back to a clean placeholder. App theme.
 */

type Callout = { n: number; label: string; desc: string };
type Shot = { src: string; caption?: string };
type Section = {
  id: string; group: string; title: string; icon: LucideIcon; intro: string;
  shots?: Shot[]; callouts?: Callout[]; steps?: string[]; tips?: string[];
};

const MANUAL: Section[] = [
  // ─────────────── GETTING STARTED ───────────────
  {
    id: "welcome", group: "Getting Started", title: "Welcome to Indus Command Center", icon: BookOpen,
    intro:
      "Indus Command Center (Indus Orbit) is the internal control panel for Indus Analytics — one place to manage clients, their ERP subscriptions and modules, onboarding, bulk data imports, tasks, emails and more. This manual walks you through every screen, starting at Login. Use the list on the left to jump to any topic, or the search box to find any button by name.",
    tips: [
      "Every screen shares the same top header and left sidebar — once you learn those, the whole app feels familiar.",
      "The app has a Light and a Dark theme — pick whichever is comfortable (see “Settings & Profile”).",
      "Re-open this manual any time from the “User Manual” button in the header.",
    ],
  },
  {
    id: "login", group: "Getting Started", title: "Logging In", icon: LogIn,
    intro:
      "The Login page is the first screen you see. Enter your work email and password to sign in. On success you land on the Home Dashboard; otherwise an error message appears above the form.",
    shots: [{ src: "s01.jpg" }],
    callouts: [
      { n: 1, label: "Username / Email", desc: "The email address your admin gave you." },
      { n: 2, label: "Password (with 👁 eye)", desc: "Your password. Click the eye icon to show/hide what you type." },
      { n: 3, label: "Remember me", desc: "Keeps you signed in on this device — use only on your own computer." },
      { n: 4, label: "Forgot Password", desc: "Ask your admin to reset it (there is no self-service reset)." },
      { n: 5, label: "Login button", desc: "Signs you in and opens the dashboard." },
    ],
    steps: [
      "Open the app link in your browser (or the installed app icon on your phone).",
      "Type your Email and Password.",
      "Click Login.",
    ],
    tips: [
      "On a phone you can “Install” the app to your home screen — it then opens full-screen like a native app.",
      "Always Sign out on shared computers (Profile menu → Sign out).",
    ],
  },

  // ─────────────── EVERYDAY BASICS ───────────────
  {
    id: "navigation", group: "Everyday Basics", title: "Header & Sidebar (getting around)", icon: Compass,
    intro:
      "The navy bar on top and the menu on the left stay on every page. The header holds quick tools (theme, chat, email, alerts, this manual, your profile); the sidebar lists every area you can open. What you see depends on the permissions your admin gave you.",
    shots: [{ src: "s11.jpg", caption: "The header runs across the top; the sidebar is the icon strip on the left." }],
    callouts: [
      { n: 1, label: "Sidebar toggle (▤, top-left)", desc: "Show/hide the left menu. On a phone it opens the menu as a slide-in drawer." },
      { n: 2, label: "Hello, <your name>", desc: "Confirms who is signed in." },
      { n: 3, label: "Theme toggle (☀/☾)", desc: "Switch the whole app between Light and Dark mode." },
      { n: 4, label: "Chat / Email / Bell", desc: "Team chat, email menu, and notifications — badges show unread counts." },
      { n: 5, label: "User Manual", desc: "Opens this guide." },
      { n: 6, label: "Profile picture", desc: "Menu with Settings and Sign out." },
      { n: 7, label: "Sidebar menu items", desc: "Click any icon/name to open that page in the main area. Hover a collapsed icon to see its name." },
    ],
    tips: ["Can’t find a page? It may be hidden because you don’t have permission — ask your admin."],
  },
  {
    id: "dashboard", group: "Everyday Basics", title: "Home Dashboard", icon: LayoutDashboard,
    intro:
      "The Home page gives you the big picture at a glance, split into three tabs. The top row shows key numbers (KPIs); below are charts and lists you can click into.",
    shots: [{ src: "s02.jpg", caption: "Overview tab — KPIs on top, charts below." }],
    callouts: [
      { n: 1, label: "Overview / Onboarding / Subscriptions tabs", desc: "Switch between company summary, implementation focus, and business-health views." },
      { n: 2, label: "KPI cards", desc: "Live counts — Total Clients, Active/Expired subscriptions, Expiring soon, CRM Leads, Provisioned, etc." },
      { n: 3, label: "Charts", desc: "Visual breakdowns (by product, by status, by state). Hover a slice/bar to see exact numbers." },
      { n: 4, label: "Lists / tables", desc: "Click any row to jump into that client or project." },
    ],
    tips: ["Switch tabs freely — data loads for the tab you open."],
  },

  // ─────────────── HEADER TOOLS ───────────────
  {
    id: "chat", group: "Header Tools", title: "Team Chat (Messages)", icon: MessageSquare,
    intro:
      "Chat with teammates in real time. Open it from the header chat icon (a side panel) or the full Messages page. Direct 1-to-1 chats live under Chats; team rooms under Groups.",
    shots: [
      { src: "s03.jpg", caption: "Header chat panel — Chats / Groups, search people." },
      { src: "s48.jpg", caption: "Full Messages page — pick a person to start chatting." },
    ],
    callouts: [
      { n: 1, label: "Chats tab", desc: "Your one-to-one conversations. A green dot means the person is online." },
      { n: 2, label: "Groups tab", desc: "Team rooms. Use “New Group” to create one." },
      { n: 3, label: "Search people", desc: "Find a colleague by name, then click to open the chat." },
    ],
    tips: ["Unread chat counts show as a green badge on the header chat icon and update live."],
  },
  {
    id: "email", group: "Header Tools", title: "Email", icon: Mail,
    intro:
      "A built-in email client. The header mail icon gives a quick inbox/compose menu; the full Email page has folders (Inbox, Sent, Archive, Trash) and Templates. Mail is sent from your own configured mailbox (see Settings / Create User → Emails).",
    shots: [
      { src: "s05.jpg", caption: "Header email menu — quick inbox + Compose." },
      { src: "s47.jpg", caption: "Full Email page — folders on the left, messages on the right." },
    ],
    callouts: [
      { n: 1, label: "Compose", desc: "Write a new email. You can apply a template to auto-fill the body and attach its files." },
      { n: 2, label: "Inbox / Sent / Archive / Trash", desc: "Your mail folders. The number next to Inbox is unread count." },
      { n: 3, label: "Templates", desc: "Reusable email templates (with attachments) for common messages to clients." },
      { n: 4, label: "Search / Refresh", desc: "Find a mail by text, or pull the latest messages." },
    ],
  },
  {
    id: "notifications", group: "Header Tools", title: "Notifications", icon: Bell,
    intro:
      "The bell in the header collects new messages, emails and system alerts. A red badge shows how many are unread. Tabs let you filter by type.",
    shots: [{ src: "s06.jpg" }],
    callouts: [
      { n: 1, label: "All / Email / Messages / Point Tool tabs", desc: "Filter notifications by source." },
      { n: 2, label: "Mark all as read", desc: "Clears the unread badge in one click." },
      { n: 3, label: "View History / ⚙ settings", desc: "See older notifications, or choose which alerts you receive." },
    ],
    tips: ["You can turn notification types (message / email / push) on or off in Settings → Notifications."],
  },
  {
    id: "settings", group: "Header Tools", title: "Settings & Profile", icon: SettingsIcon,
    intro:
      "Open Settings from your profile picture (top-right → Settings). Here you manage your Profile, Notification preferences, app Preferences (theme, font, login look), and mobile shortcuts. Sign out is in the same profile menu.",
    shots: [
      { src: "s07.jpg", caption: "Profile — photo, name, email settings, AI key, reset password." },
      { src: "s08.jpg", caption: "Notifications — toggle each alert type." },
      { src: "s09.jpg", caption: "Preferences — font + Theme Customizer + login page design." },
      { src: "s10.jpg", caption: "Bottom Navbar — pick up to 4 shortcuts for the mobile bottom bar." },
    ],
    callouts: [
      { n: 1, label: "Profile → Edit", desc: "Change your display name, profile photo (circular crop) and signature." },
      { n: 2, label: "Email Settings → Configure", desc: "Set the mailbox your emails send from (SMTP / Microsoft Graph)." },
      { n: 3, label: "Reset Password", desc: "Change your own password." },
      { n: 4, label: "Notifications toggles", desc: "Turn Message / Email / Push / System-update alerts on or off." },
      { n: 5, label: "Theme Customizer", desc: "Pick a colour theme (Default, Forest, Crimson, Royal…) — it recolours the whole app." },
      { n: 6, label: "Bottom Navbar", desc: "Choose which 4 modules appear on the phone’s bottom bar for one-tap access." },
    ],
  },

  // ─────────────── CLIENTS & ONBOARDING ───────────────
  {
    id: "clients", group: "Clients & Onboarding", title: "Clients (Client Projects)", icon: Users2,
    intro:
      "Clients is where you manage every customer. The grid lists all clients with their code, application, ERP/Cloud status and more. Open one to view and edit everything about them across tabs.",
    shots: [{ src: "s11.jpg" }],
    callouts: [
      { n: 1, label: "Create Client Project", desc: "Start the new-client wizard (if you have permission)." },
      { n: 2, label: "Search / Filters", desc: "Type a name or code, or use per-column filters, to find a client fast." },
      { n: 3, label: "Client row", desc: "Shows Client Code, Name, Application, Address, Login Name, ERP & Cloud status." },
      { n: 4, label: "Actions (👁 / ✎)", desc: "View or open a client to edit its full details." },
    ],
    tips: ["Deleting is a “soft delete” — records are hidden, not erased, so nothing is lost by accident."],
  },
  {
    id: "create-client", group: "Clients & Onboarding", title: "Create a Client Project", icon: UserPlus,
    intro:
      "The wizard sets up a brand-new client in 5 steps: Database → Subscription → Company → Branch → Production. You can also pull an existing CRM client to pre-fill the details.",
    shots: [
      { src: "s12.jpg", caption: "Step 1 — Database: server, application, backup type, client & database name." },
      { src: "s13.jpg", caption: "Pick a CRM Client — choose a known lead to pre-fill (Pending / Proceed tabs)." },
    ],
    callouts: [
      { n: 1, label: "Step indicators (1–5)", desc: "Database, Subscription, Company, Branch, Production — do them in order." },
      { n: 2, label: "CRM Client button", desc: "Open the CRM picker to auto-fill company/contact details from an existing lead." },
      { n: 3, label: "Create Database & Continue", desc: "Creates the client’s database from a template and moves to the next step." },
    ],
    steps: [
      "Open Clients → Create Client Project.",
      "Optionally click CRM Client and Apply a lead to pre-fill.",
      "Fill Step 1 (Database) and click Create Database & Continue.",
      "Complete Subscription, Company, Branch and Production steps.",
    ],
  },
  {
    id: "client-detail", group: "Clients & Onboarding", title: "Client Details (Company Detail)", icon: Building2,
    intro:
      "Opening a client shows its full profile. The Company Detail tab holds Client Information, Address & Contact, the ERP and Cloud Subscriptions, and Login & Access details. Click Edit to change anything.",
    shots: [
      { src: "s14.jpg", caption: "Top — Client Information, Address & Contact, ERP Subscription." },
      { src: "s15.jpg", caption: "Scroll down — Cloud Subscription and Login & Access (with copy buttons)." },
    ],
    callouts: [
      { n: 1, label: "Company Detail / Module Authority tabs", desc: "Switch between the client’s profile and its module permissions." },
      { n: 2, label: "ERP / Cloud Subscription", desc: "Status, period, from/to dates, payment-due and exceed-date info." },
      { n: 3, label: "Login & Access", desc: "The client’s login name, password, application URL and connection string — each has a copy button." },
      { n: 4, label: "Edit", desc: "Unlock the fields to update them, then Save." },
    ],
  },
  {
    id: "module-authority", group: "Clients & Onboarding", title: "Module Authority (a client’s modules)", icon: ShieldCheck,
    intro:
      "Inside a client, the Module Authority tab controls which ERP modules that client can use. Module Settings turns modules on/off; Module Group Authority applies a ready-made group of modules; New Module Addition adds a custom module.",
    shots: [
      { src: "s16.jpg", caption: "Module Settings — tick to enable a module; Save Modules." },
      { src: "s17.jpg", caption: "Module Group Authority — apply a whole group at once." },
      { src: "s18.jpg", caption: "New Module Addition — add a module from catalog or custom." },
    ],
    callouts: [
      { n: 1, label: "Module Settings checkboxes", desc: "Tick/untick each module. The header checkbox selects all currently-shown rows." },
      { n: 2, label: "Copy As", desc: "Copy this client’s whole module setup to another client." },
      { n: 3, label: "Save Modules", desc: "Applies your on/off changes to the client’s database." },
      { n: 4, label: "Load Modules → Apply to Client", desc: "In Group Authority: load a group’s modules, then apply them all in one go." },
      { n: 5, label: "Create / Save Module", desc: "In New Module Addition: add a module (from the catalog or a custom one) with its group and order." },
    ],
    tips: ["Bulk actions here update the client’s live modules — a security check may appear before it runs."],
  },
  {
    id: "kickoff", group: "Clients & Onboarding", title: "Kick-Off Document", icon: FileSignature,
    intro:
      "Generate and manage a client’s Kick-Off document. Pick the Product + Client, then open, edit, save, download or email the document. It auto-fills from the client’s live data.",
    shots: [{ src: "s19.jpg" }],
    callouts: [
      { n: 1, label: "Open Document (Edit & Save)", desc: "Open the saved copy to edit and re-save." },
      { n: 2, label: "Open New Template", desc: "Open the latest blank template (non-destructive — your saved copy stays safe until you Save)." },
      { n: 3, label: "View Saved / Download", desc: "View the finalized version, or download it as a PDF." },
      { n: 4, label: "Email to Client", desc: "Send the document to the client by email." },
      { n: 5, label: "History", desc: "See past saves and emails of this document." },
    ],
  },
  {
    id: "tracker", group: "Clients & Onboarding", title: "Tracker (Roadmap, Training, CRs)", icon: Map,
    intro:
      "The implementation Tracker for a client has three tabs: Milestone Roadmap (the 14-phase plan), Training & Daily Status, and Change Request. Each has a grid you can fill in, plus Download Template / Import Excel / Create.",
    shots: [
      { src: "s20.jpg", caption: "Milestone Roadmap — phases and % complete." },
      { src: "s21.jpg", caption: "Training & Daily Status — module-wise training log." },
      { src: "s22.jpg", caption: "Change Request — client-raised changes." },
    ],
    callouts: [
      { n: 1, label: "Milestone / Training / Change Request tabs", desc: "Switch between the roadmap, training log, and change requests." },
      { n: 2, label: "Download Template", desc: "Get the exact Excel format to fill in." },
      { n: 3, label: "Import Excel", desc: "Upload your filled Excel to load many rows at once." },
      { n: 4, label: "Create", desc: "Add a single row by hand." },
    ],
  },
  {
    id: "templates", group: "Clients & Onboarding", title: "Template Master Excel", icon: FileSpreadsheet,
    intro:
      "A shared library of master-data Excel templates (HSN, Item, Ledger, Tool…). Tick the ones a client needs and email them, so the client fills them in for bulk upload.",
    shots: [{ src: "s23.jpg" }],
    callouts: [
      { n: 1, label: "Grouped templates", desc: "Templates are grouped by master (HSN Master, Item Master…). The number is how many files are in that group." },
      { n: 2, label: "Checkboxes", desc: "Tick the templates you want to send." },
      { n: 3, label: "Email Selected", desc: "Email the ticked templates to the client." },
      { n: 4, label: "Download / Delete (per file)", desc: "Download a template, or remove it from the library." },
      { n: 5, label: "Upload Template", desc: "Add a new master template to the shared library." },
    ],
  },
  {
    id: "signoff", group: "Clients & Onboarding", title: "Sign-Off Document", icon: ClipboardCheck,
    intro:
      "The project Sign-Off document — same workflow as Kick-Off. Open, edit, save, download or email the sign-off, which auto-fills from the client’s data and includes the readiness checklist and signatures.",
    shots: [{ src: "s24.jpg" }],
    callouts: [
      { n: 1, label: "Open Document (Edit & Save)", desc: "Edit and re-save the sign-off." },
      { n: 2, label: "Open New Template", desc: "Start from the latest template without touching the saved copy." },
      { n: 3, label: "View Saved / Download / Email to Client", desc: "Review, download as PDF, or send to the client." },
      { n: 4, label: "History", desc: "Past saves and emails of the sign-off." },
    ],
  },
  {
    id: "onsite", group: "Clients & Onboarding", title: "Onsite Management", icon: Plane,
    intro:
      "Record onsite visits for a client — who went, when, where, and the costs (tickets, hotel, food). Fill the grid by hand, or bulk-load with Download Template + Import Excel.",
    shots: [{ src: "s25.jpg" }],
    callouts: [
      { n: 1, label: "Create", desc: "Add a single onsite-visit row." },
      { n: 2, label: "Download Template / Import Excel", desc: "Get the format, fill it, and upload many visits at once." },
      { n: 3, label: "Visit columns", desc: "Person, Age, Mobile, Location, From/To, Days, Tickets, Hotel & Food charges." },
    ],
  },
  {
    id: "sop", group: "Clients & Onboarding", title: "SOP of Web Modules", icon: BookMarked,
    intro:
      "A library of step-by-step SOP documents (and YouTube links) for the ERP’s web modules. Pick Product + Client, Load, then per module you can open its SOP, set a YouTube link and a Status.",
    shots: [{ src: "s26.jpg" }],
    callouts: [
      { n: 1, label: "Load Module", desc: "Load the module list for the selected client." },
      { n: 2, label: "SOP Document → View", desc: "Open the module’s SOP guide in a new tab (only shown if a document exists)." },
      { n: 3, label: "Youtube Link", desc: "The training video for that module." },
      { n: 4, label: "Status checkbox", desc: "Mark a module as done/enabled for this client." },
      { n: 5, label: "Action (✎ / 🗑)", desc: "Edit or delete a module’s SOP details — shown only if you have Edit / Delete permission." },
    ],
  },

  // ─────────────── BULK IMPORT ───────────────
  {
    id: "import-master", group: "Bulk Import", title: "Bulk Import — Import Master", icon: PackageOpen,
    intro:
      "Import Master loads master data (Item, Ledger, Tool, HSN, Spare Part) into a client’s ERP from Excel. Every Bulk Import screen starts the same way: pick the Indus Product and Client, then the master and its group.",
    shots: [
      { src: "s27.jpg", caption: "1) Pick Product + Client — nothing loads until a client is chosen." },
      { src: "s28.jpg", caption: "2) Pick the Master (e.g. Ledger) and its Group (e.g. Clients)." },
      { src: "s29.jpg", caption: "3) Load Data shows existing records; the pickers collapse to give the grid full height." },
      { src: "s31.jpg", caption: "4) Upload your Excel — rows appear as a preview." },
      { src: "s32.jpg", caption: "5) Check Validation — a summary flags missing / duplicate / mismatched cells to fix before saving." },
    ],
    callouts: [
      { n: 1, label: "Indus Product / Client", desc: "Choose the product (defaults to Estimoprime), then the client whose database you’ll work on." },
      { n: 2, label: "Module (Master) / Group", desc: "Pick the master (e.g. Item Master) and its group (e.g. PAPER)." },
      { n: 3, label: "Load Data", desc: "View the client’s existing records." },
      { n: 4, label: "Fresh / Existing Upload", desc: "Upload your Excel file to import new rows." },
      { n: 5, label: "Export", desc: "Download all columns as an Excel template to fill in." },
      { n: 6, label: "Check Validation", desc: "Highlights problem cells (missing / duplicate / mismatch / invalid) — click a summary card to filter those rows." },
      { n: 7, label: "Save Data", desc: "Writes the validated rows to the client’s database (it re-checks validation first)." },
      { n: 8, label: "Clear All Data", desc: "Wipes a group’s data — guarded by a security check (see the warning dialog)." },
      { n: 9, label: "Change (collapsed bar)", desc: "After data loads the pickers collapse; click Change to pick a different product / client / master." },
    ],
    steps: [
      "Select Indus Product, then Client Name.",
      "Pick the Master + Group.",
      "Export to get the template, fill your Excel, then Fresh/Existing Upload.",
      "Click Check Validation and fix anything highlighted.",
      "Click Save Data to commit.",
    ],
    tips: ["Blue = missing, red = duplicate, yellow = doesn’t match the master, purple = wrong format. Edit cells directly in the grid."],
  },
  {
    id: "stock-upload", group: "Bulk Import", title: "Bulk Import — Stock Upload", icon: Boxes,
    intro:
      "Upload opening/received stock for Item, Tool or Spare Part masters. Pick the module and group, then Load Data to enter quantities, Check Stock to view existing stock, or Upload Excel to import.",
    shots: [
      { src: "s33.jpg", caption: "Pick the module (Item / Tool / Spare Part)." },
      { src: "s34.jpg", caption: "Pick the group (e.g. REEL); buttons for Load / Check / Reset / Upload appear." },
      { src: "s35.jpg", caption: "Data loaded — grid with ItemCode, quantity, rate, batch, warehouse…" },
      { src: "s36.jpg", caption: "Check Validation — flags cells still missing required data." },
    ],
    callouts: [
      { n: 1, label: "Load Data", desc: "Bring in the master items so you can enter quantities." },
      { n: 2, label: "Check Stock", desc: "View the existing stock (read-only)." },
      { n: 3, label: "Upload Excel", desc: "Import a filled stock file (e.g. REELStock.xlsx)." },
      { n: 4, label: "Reset Item / Floor Stock", desc: "Clear stock — a security check protects this." },
      { n: 5, label: "Check Validation → Save", desc: "Fix highlighted cells, then save the stock to the client’s database." },
    ],
  },
  {
    id: "content-authority", group: "Bulk Import", title: "Bulk Import — Content Authority", icon: Images,
    intro:
      "Manage a client’s box/keyline content: 2D dieline blueprints and 3D interactive previews per content type, with a sync status. Tick content and push it, or update content / keyline details.",
    shots: [
      { src: "s37.jpg", caption: "Content list — Open/Close view thumbnails + DB status per content." },
      { src: "s38.jpg", caption: "2D Blueprint — the dieline with L/W/H/flap dimensions." },
      { src: "s39.jpg", caption: "3D Interactive — rotate and fold/unfold the box." },
    ],
    callouts: [
      { n: 1, label: "Content rows", desc: "Each content type with its Open-View and Close-View images and DB status (Synced / Not Synced)." },
      { n: 2, label: "ⓘ image icon", desc: "Click to open the Master Blueprint — a 2D Blueprint and a 3D Interactive preview." },
      { n: 3, label: "2D Blueprint / 3D Interactive tabs", desc: "See the flat dieline, or a foldable 3D box (Play, Reset, Top/Front/Side)." },
      { n: 4, label: "Select All + checkboxes", desc: "Choose which content to sync." },
      { n: 5, label: "Save Content / Update Content Details / Update Keyline Details", desc: "Push the selected content, or re-sync its content / keyline data (with a progress bar)." },
    ],
  },
  {
    id: "erp-delete", group: "Bulk Import", title: "Bulk Import — ERP Transaction Delete", icon: Trash2,
    intro:
      "A cleanup tool for a client’s ERP database. Master Wise Data deletes a chosen master; All Transaction without Master deletes every transaction while keeping master tables. Both are destructive and warn you clearly.",
    shots: [
      { src: "s40.jpg", caption: "Master Wise Data — pick a module, then Delete Master Data." },
      { src: "s41.jpg", caption: "All Transaction without Master — delete all transactions, masters preserved." },
    ],
    callouts: [
      { n: 1, label: "Master Wise Data tab", desc: "Choose a Module Name and delete only that master’s data." },
      { n: 2, label: "All Transaction without Master tab", desc: "Delete ALL transactional records (stock, tool, ledger transactions…) while keeping master tables." },
      { n: 3, label: "Warning / Danger banners", desc: "These actions permanently delete data — take a backup first (see Database Backup)." },
    ],
    tips: ["Because this is permanent, always download a Database Backup before deleting."],
  },
  {
    id: "company-master", group: "Bulk Import", title: "Bulk Import — Company Master", icon: Building2,
    intro:
      "Edit a client’s full ERP company profile across 13 tabs — identity/address, production, tax, estimation, approvals, workflow, printing and more. Pick Product + Client, click Edit Details, change, and save.",
    shots: [
      { src: "s42.jpg", caption: "Company Info — identity, address, contact, statutory numbers." },
      { src: "s43.jpg", caption: "Production Unit — address, back-day, production toggles." },
      { src: "s44.jpg", caption: "Tax Config — purchase tolerance, GST/VAT/e-Invoice flags." },
      { src: "s45.jpg", caption: "Estimation — decimal places and calculation flags." },
      { src: "s46.jpg", caption: "Approvals — which approvals are required." },
    ],
    callouts: [
      { n: 1, label: "13 tabs", desc: "Company Info, Production Unit, Tax Config, Estimation, Domain Features, Approvals, Production Settings, System Config, Workflow, Communication, Client Comm., Printing & Docs, Prefixes." },
      { n: 2, label: "Edit Details", desc: "Unlock the fields (and ON/OFF switches) to change them." },
      { n: 3, label: "ON/OFF switches", desc: "Feature flags — e.g. GST Applicable, Job Schedule Release Required." },
      { n: 4, label: "Change (top-right)", desc: "Switch to a different product / client." },
    ],
    tips: ["Save writes back the whole profile, so nothing on the other tabs is lost when you save."],
  },
  {
    id: "module-group-authority", group: "Bulk Import", title: "Module Group Authority", icon: Layers,
    intro:
      "Create and manage reusable module groups per application (e.g. a “Sales Package”). Later you can apply a whole group to a client in one click from the client’s Module Authority tab.",
    shots: [
      { src: "s56.jpg", caption: "Pick an application + group, or Create / Edit / Delete a group." },
      { src: "s57.jpg", caption: "Create Module Group — name it and tick the modules it contains." },
    ],
    callouts: [
      { n: 1, label: "Create / Edit / Delete Group", desc: "Manage the module groups for an application." },
      { n: 2, label: "Application Name / Module Group", desc: "Pick the app, then a group to view or edit its modules." },
      { n: 3, label: "Load Module", desc: "Show the modules in the selected group." },
      { n: 4, label: "Select Modules (in Create)", desc: "Tick the modules the new group should contain, then Create Group." },
    ],
  },

  // ─────────────── ADMINISTRATION ───────────────
  {
    id: "user-management", group: "Administration", title: "User Management", icon: Users2,
    intro:
      "Create and manage the people who use Indus Command Center. The User Master lists active and inactive users; Create User opens a 3-tab form: the user’s profile, their module permissions, and their mailbox.",
    shots: [
      { src: "s49.jpg", caption: "User Master — Active / Inactive users, Create User." },
      { src: "s50.jpg", caption: "Create User → User Profile — name, role, password, feature chips." },
      { src: "s51.jpg", caption: "Module Authentication — per-module View/Save/Edit/Delete… permissions." },
      { src: "s52.jpg", caption: "Emails — the mailbox this user sends from (SMTP / Graph)." },
    ],
    callouts: [
      { n: 1, label: "Active / Inactive tabs", desc: "Switch between users who can log in and those who are disabled." },
      { n: 2, label: "Create User", desc: "Add a new user." },
      { n: 3, label: "Actions (👁 / ✎ / 🗑)", desc: "View, edit or remove a user." },
      { n: 4, label: "User Profile tab", desc: "Name, email, mobile, role, team lead, password, Active toggle, and feature chips (Can Create Project, etc.)." },
      { n: 5, label: "Module Authentication tab", desc: "For each module, grant Can View / Save / Edit / Delete / Export / Print / Cancel. This is what shows or hides pages and buttons for that user." },
      { n: 6, label: "Emails tab", desc: "The user’s outgoing mailbox settings and email signature." },
    ],
    tips: ["A user only sees a page (and its buttons) if you grant the matching permission here."],
  },
  {
    id: "project-assignment", group: "Administration", title: "Project Assignment", icon: FolderKanban,
    intro:
      "Decide which client projects each user can see. Pick a user on the left, tick the projects they should have, and Save. Admins see all clients regardless.",
    shots: [
      { src: "s53.jpg", caption: "Pick a user from the list." },
      { src: "s54.jpg", caption: "Tick the client projects to assign, then Save." },
    ],
    callouts: [
      { n: 1, label: "Users list", desc: "Search and pick the user to assign projects to." },
      { n: 2, label: "Search projects / Indus Product filter", desc: "Narrow the project list by name, code or product." },
      { n: 3, label: "Select all / Clear", desc: "Assign or unassign every shown project at once." },
      { n: 4, label: "Save", desc: "Saves the user’s assigned projects (an “assigned” count shows at the top)." },
    ],
  },
  {
    id: "database-backup", group: "Administration", title: "Database Backup", icon: DatabaseBackup,
    intro:
      "Download a fresh, compressed backup of a client’s ERP database as a .zip file — useful before any bulk delete or major change.",
    shots: [{ src: "s55.jpg" }],
    callouts: [
      { n: 1, label: "Indus Product / Client Name", desc: "Pick the client whose database you want to back up." },
      { n: 2, label: "Download Backup", desc: "Prepares a fresh backup and downloads it to your machine as a .zip." },
    ],
    tips: ["Access to this page is controlled — your admin grants it per user."],
  },
];

const GROUP_ORDER = ["Getting Started", "Everyday Basics", "Header Tools", "Clients & Onboarding", "Bulk Import", "Administration"];

// ── Screenshot with a graceful placeholder when the image hasn't been added yet. ─────────────────────
function Shot({ shot, title }: { shot: Shot; title: string }) {
  const [ok, setOk] = useState(true);
  return (
    <figure style={{ margin: "0 0 14px" }}>
      {shot.caption && <figcaption style={{ fontSize: 12, fontWeight: 600, color: "rgb(var(--fg-muted))", marginBottom: 6 }}>{shot.caption}</figcaption>}
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/manual/${shot.src}`} alt={shot.caption || title} onError={() => setOk(false)}
          style={{ width: "100%", borderRadius: 12, border: "1px solid rgb(var(--bd-default))", boxShadow: "0 8px 24px -12px rgba(16,24,40,.3)", display: "block" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 200, borderRadius: 12, border: "1.5px dashed rgb(var(--bd-default))", background: "rgb(var(--bg-subtle))", color: "rgb(var(--fg-muted))" }}>
          <ImageOff size={26} /><div style={{ fontSize: 12.5, fontWeight: 700 }}>Screenshot coming soon</div>
        </div>
      )}
    </figure>
  );
}

export default function UserManual({ onClose }: { onClose: () => void }) {
  const [activeId, setActiveId] = useState(MANUAL[0].id);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const matches = (s: Section) =>
    !query || s.title.toLowerCase().includes(query) || s.intro.toLowerCase().includes(query) ||
    (s.callouts ?? []).some((c) => (c.label + c.desc).toLowerCase().includes(query));

  const grouped = useMemo(() => {
    const g: Record<string, Section[]> = {};
    for (const s of MANUAL) if (matches(s)) (g[s.group] ??= []).push(s);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const active = MANUAL.find((s) => s.id === activeId) ?? MANUAL[0];
  const primary = "rgb(var(--color-primary))";

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10050, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "min(4vh, 40px) 16px" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1060px, 100%)", height: "min(90vh, 940px)", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px -20px rgba(2,6,23,.6)", border: "1px solid rgb(var(--bd-default))" }}>
        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "rgb(var(--color-primary-hover))", color: "#fff", flexShrink: 0 }}>
          <span style={{ display: "inline-flex", width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.16)", alignItems: "center", justifyContent: "center" }}><BookOpen size={19} /></span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>User Manual</div>
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>Indus Command Center — a step-by-step guide, from Login to every module</div>
          </div>
          <button onClick={onClose} title="Close" aria-label="Close" style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(255,255,255,.16)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Contents */}
          <aside style={{ width: 280, flexShrink: 0, borderRight: "1px solid rgb(var(--bd-default))", background: "rgb(var(--bg-subtle))", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ padding: 12, borderBottom: "1px solid rgb(var(--bd-default))" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "rgb(var(--fg-muted))" }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the manual…"
                  style={{ width: "100%", padding: "8px 10px 8px 30px", fontSize: 12.5, borderRadius: 9, border: "1px solid rgb(var(--bd-default))", background: "rgb(var(--bg-surface))", color: "rgb(var(--fg-default))", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <nav style={{ overflowY: "auto", padding: "8px 8px 16px", flex: 1 }}>
              {GROUP_ORDER.filter((grp) => grouped[grp]?.length).map((grp) => (
                <div key={grp} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "rgb(var(--fg-muted))", padding: "6px 8px" }}>{grp}</div>
                  {grouped[grp].map((s) => {
                    const on = s.id === activeId; const Icon = s.icon;
                    return (
                      <button key={s.id} onClick={() => { setActiveId(s.id); }}
                        style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, marginBottom: 2, background: on ? primary : "transparent", color: on ? "#fff" : "rgb(var(--fg-default))", fontWeight: on ? 700 : 500 }}>
                        <Icon size={15} style={{ flexShrink: 0, opacity: on ? 1 : 0.7 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>{s.title}</span>
                        {on && <ChevronRight size={14} />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!GROUP_ORDER.some((grp) => grouped[grp]?.length) && <div style={{ padding: 16, fontSize: 12.5, color: "rgb(var(--fg-muted))", textAlign: "center" }}>No topics match “{q}”.</div>}
            </nav>
          </aside>

          {/* Content */}
          <main key={active.id} style={{ flex: 1, overflowY: "auto", padding: "22px 26px 40px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ display: "inline-flex", width: 30, height: 30, borderRadius: 8, background: "rgba(31,69,118,.1)", color: primary, alignItems: "center", justifyContent: "center" }}><active.icon size={17} /></span>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{active.title}</h2>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, opacity: 0.9, margin: "8px 0 18px" }}>{active.intro}</p>

            {active.shots?.map((sh, i) => <Shot key={i} shot={sh} title={active.title} />)}

            {active.callouts && active.callouts.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: primary, display: "flex", alignItems: "center", gap: 7, margin: "0 0 10px" }}><MousePointerClick size={15} /> What each part does</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {active.callouts.map((c) => (
                    <div key={c.n} style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "rgb(var(--bg-subtle))", border: "1px solid rgb(var(--bd-default))" }}>
                      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: primary, color: "#fff", fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center" }}>{c.n}</span>
                      <div><b style={{ fontSize: 13 }}>{c.label}</b><div style={{ fontSize: 12.5, color: "rgb(var(--fg-muted))", lineHeight: 1.55, marginTop: 2 }}>{c.desc}</div></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {active.steps && active.steps.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: primary, display: "flex", alignItems: "center", gap: 7, margin: "0 0 10px" }}><ListChecks size={15} /> Step by step</h3>
                <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>{active.steps.map((s, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{s}</li>)}</ol>
              </section>
            )}

            {active.tips && active.tips.length > 0 && (
              <section style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(234,179,8,.1)", border: "1px solid rgba(234,179,8,.3)" }}>
                <h3 style={{ fontSize: 12.5, fontWeight: 800, color: "#a16207", display: "flex", alignItems: "center", gap: 7, margin: "0 0 8px" }}><Lightbulb size={15} /> Tips</h3>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>{active.tips.map((t, i) => <li key={i} style={{ fontSize: 12.5, lineHeight: 1.6 }}>{t}</li>)}</ul>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
