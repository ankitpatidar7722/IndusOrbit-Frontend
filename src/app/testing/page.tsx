"use client";

/**
 * Data Grid showcase — migrated from the legacy Parkson `/testing` screen.
 *
 * The grid itself (DataGrid + createActionsColumn + all cells/controls/search)
 * ships inside the `indas-ui` package that Indus 360 already depends on, so there
 * is nothing to copy into `src/` — this page demonstrates the full feature set:
 * row selection (single/multi, ctrl+shift), column resize / reorder / freeze /
 * chooser, virtualization, per-column filter row, global + advanced search,
 * grouping, export/import, card & chart views, summary/aggregation row, and a
 * built-in actions column with a delete-confirmation dialog.
 */

import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, useModalAlert } from "indas-ui";
// Grid migrated from the legacy Parkson project — now owned source under src/components/datagrid.
import { DataGrid, createActionsColumn } from "@/components/datagrid";
import { Grid3x3 } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Test data
// ────────────────────────────────────────────────────────────────────────────

interface TestUser {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "User" | "Guest";
  status: "Active" | "Inactive" | "Pending";
  department: string;
  lastLogin: string;
  permissions: number;
  createdAt: string;
  phone: string;
  location: string;
  salary: number;
  performance: number;
  projectsCompleted: number;
  hoursWorked: number;
  manager: string;
  teamSize: number;
  certifications: string[];
  birthDate: string;
  experience: number;
  contractType: "Full-time" | "Part-time" | "Contract" | "Intern";
}

/** YYYY-MM-DD, timezone-safe (avoids UTC shift from toISOString). */
function getLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Deterministic PRNG so the dataset is identical on server + client (no
 *  hydration mismatch) and stable across renders. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/** Fully deterministic test dataset exercising the grid's edge cases
 *  (very long values, tiny values, badges, progress bars, dates, numbers). */
function generateTestUsers(count = 150): TestUser[] {
  const firstNames = ["John", "Jane", "Alice", "Bob", "Charlie", "Diana", "Edward", "Fiona", "George", "Helen", "Ivan", "Julia", "Kevin", "Lisa", "Michael", "Nancy", "Oscar", "Paula", "Quincy", "Rachel", "Sam", "Tina", "Victor", "Wendy", "Xavier", "Yolanda", "Zach", "Amy", "Brian", "Catherine"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"];
  const departments = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations", "Design", "Support", "Legal", "Security"];
  const roles: TestUser["role"][] = ["Admin", "Manager", "User", "Guest"];
  const statuses: TestUser["status"][] = ["Active", "Inactive", "Pending"];
  const locations = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte", "San Francisco", "Indianapolis", "Seattle", "Denver", "Washington", "Boston", "Nashville", "El Paso", "Detroit", "Portland"];
  const contractTypes: TestUser["contractType"][] = ["Full-time", "Part-time", "Contract", "Intern"];
  const certificationsList = [
    ["AWS Certified", "React Developer"],
    ["PMP", "Scrum Master"],
    ["CPA", "Six Sigma"],
    ["CISSP", "CISM"],
    ["Google Analytics", "HubSpot"],
    ["Salesforce", "Tableau"],
    ["Docker", "Kubernetes"],
    ["PRINCE2", "ITIL"],
  ];

  return Array.from({ length: count }, (_, i) => {
    if (i === 0) {
      return {
        id: "T1",
        name: "VeryLongNameThatExceeds200CharactersVeryLongNameThatExceeds200CharactersVeryLongNameThatExceeds200CharactersVeryLongNameThatExceeds200CharactersVeryLongNameThatExceeds200CharactersVeryLongNameThatExceeds200CharactersVeryLongNameThatExceeds200Characters",
        email: "extremely.long.email.address.that.tests.column.sizing.behavior.in.advanced.data.grid@verylongcompanydomainname.com",
        role: "Admin", status: "Active", department: "Engineering", lastLogin: "2024-01-15",
        permissions: 9999999999, createdAt: "2023-01-01", phone: "+1-555-999-8888-7777-6666",
        location: "San Francisco Bay Area California USA", salary: 9999999999, performance: 99.9,
        projectsCompleted: 9999, hoursWorked: 99999, experience: 25.5,
        manager: "Very Long Manager Name That Tests Column Width", teamSize: 999,
        certifications: ["AWS Solutions Architect Professional", "Google Cloud Professional Cloud Architect", "Microsoft Azure Solutions Architect Expert"],
        birthDate: "1990-01-01", contractType: "Full-time",
      };
    }
    if (i === 1) {
      return {
        id: "A", name: "Al", email: "a@b.co", role: "User", status: "Active", department: "IT",
        lastLogin: "2024-01-01", permissions: 1, createdAt: "2024-01-01", phone: "555-0001",
        location: "NY", salary: 50000, performance: 85.0, projectsCompleted: 5, hoursWorked: 1000,
        experience: 2.0, manager: "Bob", teamSize: 3, certifications: ["PMP"], birthDate: "1995-05-15",
        contractType: "Full-time",
      };
    }
    if (i === 2) {
      return {
        id: "12345678901234567890", name: "Test User With Moderate Length Name",
        email: "moderatelengthtestuser@company.org", role: "Manager", status: "Pending",
        department: "Sales", lastLogin: "2024-01-10", permissions: 1234567890, createdAt: "2023-06-15",
        phone: "+1-800-555-0199", location: "Chicago", salary: 125000, performance: 92.5,
        projectsCompleted: 47, hoursWorked: 2080, experience: 8.5, manager: "Regional Director",
        teamSize: 12, certifications: ["Salesforce Admin", "HubSpot"], birthDate: "1985-03-22",
        contractType: "Contract",
      };
    }

    const s = i * 7;
    const firstName = firstNames[Math.floor(seededRandom(s + 1) * firstNames.length)];
    const lastName = lastNames[Math.floor(seededRandom(s + 2) * lastNames.length)];
    const role = roles[Math.floor(seededRandom(s + 3) * roles.length)];
    const department = departments[Math.floor(seededRandom(s + 4) * departments.length)];
    const status = statuses[Math.floor(seededRandom(s + 5) * statuses.length)];
    const experience = Math.floor(seededRandom(s + 6) * 20) + 1;
    const baseSalary = role === "Admin" ? 120000 : role === "Manager" ? 85000 : role === "User" ? 65000 : 45000;
    const salary = baseSalary + Math.floor(seededRandom(s + 7) * 50000);
    // Deterministic dates (fixed reference — NOT Date.now(), so SSR === CSR).
    const lastLogin = getLocalDateString(new Date(2024, 5, 1 - Math.floor(seededRandom(s + 8) * 90)));

    return {
      id: `user-${String(i + 1).padStart(4, "0")}`,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
      role, status, department, lastLogin,
      permissions: role === "Admin" ? 15 : role === "Manager" ? Math.floor(seededRandom(s + 9) * 6) + 10 : Math.floor(seededRandom(s + 10) * 8) + 3,
      createdAt: getLocalDateString(new Date(2020 + Math.floor(seededRandom(s + 11) * 4), Math.floor(seededRandom(s + 12) * 12), Math.floor(seededRandom(s + 13) * 28) + 1)),
      phone: `+1-555-${String(Math.floor(seededRandom(s + 14) * 10000)).padStart(4, "0")}`,
      location: locations[Math.floor(seededRandom(s + 15) * locations.length)],
      salary,
      performance: Math.floor(seededRandom(s + 16) * 100),
      projectsCompleted: Math.floor(seededRandom(s + 17) * 50),
      hoursWorked: Math.floor(seededRandom(s + 18) * 2000) + 500,
      manager: `Manager ${Math.floor(seededRandom(s + 19) * 10) + 1}`,
      teamSize: role === "Manager" ? Math.floor(seededRandom(s + 20) * 15) + 5 : role === "Admin" ? Math.floor(seededRandom(s + 21) * 25) + 10 : Math.floor(seededRandom(s + 22) * 5),
      certifications: certificationsList[Math.floor(seededRandom(s + 23) * certificationsList.length)],
      birthDate: getLocalDateString(new Date(1970 + Math.floor(seededRandom(s + 24) * 35), Math.floor(seededRandom(s + 25) * 12), Math.floor(seededRandom(s + 26) * 28) + 1)),
      experience,
      contractType: contractTypes[Math.floor(seededRandom(s + 27) * contractTypes.length)],
    };
  });
}

const TEST_USERS = generateTestUsers(150);

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function DataGridTestingPage() {
  const { showSuccess, showWarning, AlertComponent } = useModalAlert();

  const [rows, setRows] = React.useState<TestUser[]>(TEST_USERS);
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [userViewMode, setUserViewMode] = React.useState<"all" | "selected">("all");

  const onRowSelect = React.useCallback((selectedRows: TestUser[]) => {
    setSelectedUserIds(selectedRows.map((r) => r.id));
  }, []);

  const handleRowReorder = React.useCallback((reordered: TestUser[]) => {
    setRows(reordered);
  }, []);

  const handleImport = React.useCallback((imported: TestUser[]) => {
    setRows((prev) => [...imported, ...prev]);
    showSuccess("Import complete", `${imported.length} row(s) added to the grid.`);
  }, [showSuccess]);

  const columns = React.useMemo<ColumnDef<TestUser>[]>(() => [
    { accessorKey: "name", header: "Name", meta: { inputType: "text" } },
    { accessorKey: "email", header: "Email", meta: { inputType: "email" } },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.role === "Admin" ? "default" : "secondary"}>{row.original.role}</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const st = row.original.status;
        return (
          <Badge variant={st === "Active" ? "success" : st === "Pending" ? "warning" : "secondary"}>{st}</Badge>
        );
      },
    },
    { accessorKey: "department", header: "Department", meta: { inputType: "text" } },
    { accessorKey: "salary", header: "Salary", meta: { inputType: "number", type: "number" } },
    {
      accessorKey: "performance",
      header: "Performance",
      meta: { inputType: "number", type: "number" },
      cell: ({ row }) => {
        const perf = row.original.performance;
        const color = perf >= 85 ? "#22c55e" : perf >= 70 ? "#3b82f6" : perf >= 50 ? "#eab308" : "#ef4444";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 56, height: 8, borderRadius: 9999, background: "#e5e7eb" }}>
              <div style={{ height: 8, width: `${perf}%`, borderRadius: 9999, background: color, transition: "width .3s" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, minWidth: 34 }}>{perf}%</span>
          </div>
        );
      },
    },
    { accessorKey: "projectsCompleted", header: "Projects", meta: { inputType: "number", type: "number" } },
    { accessorKey: "experience", header: "Experience", meta: { inputType: "number", type: "number" } },
    {
      accessorKey: "contractType",
      header: "Contract",
      cell: ({ row }) => {
        const ct = row.original.contractType;
        const variant = ct === "Full-time" ? "success" : ct === "Part-time" ? "info" : ct === "Contract" ? "warning" : "info";
        return <Badge variant={variant}>{ct}</Badge>;
      },
    },
    { accessorKey: "location", header: "Location", meta: { inputType: "text" } },
    { accessorKey: "manager", header: "Manager", meta: { inputType: "text" } },
    { accessorKey: "teamSize", header: "Team Size", meta: { inputType: "number", type: "number" } },
    { accessorKey: "hoursWorked", header: "Hours Worked", meta: { inputType: "number", type: "number" } },
    { accessorKey: "lastLogin", header: "Last Login", meta: { inputType: "date", type: "date" } },
    { accessorKey: "createdAt", header: "Joined", meta: { inputType: "date", type: "date" } },
    createActionsColumn<TestUser>({
      onView: (row) => showSuccess("View user", `${row.name} · ${row.email}`),
      onEdit: (row) => showSuccess("Edit user", `Opening editor for ${row.name}…`),
      onDelete: (row) => {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
        showWarning("User deleted", `${row.name} was removed from the grid.`);
      },
      showView: true,
      showEdit: true,
      showDelete: true,
      mode: "buttons",
      primaryActions: ["view", "edit", "delete"],
      confirmDelete: true,
      deleteConfirmation: {
        title: "Delete User",
        description: "Are you sure you want to delete this user? This action cannot be undone.",
      },
    }),
  ], [showSuccess, showWarning]);

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgb(var(--color-primary))", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Grid3x3 size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "rgb(var(--color-primary))" }}>Data Grid</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "rgb(var(--fg-muted))" }}>
            Full-featured DataGrid — selection, resize / reorder / freeze, filter row, search,
            grouping, export &amp; import, card / chart views, and an aggregation summary row.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16, background: "rgb(var(--bg-surface))", borderRadius: 12, boxShadow: "0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.04)", border: "1px solid #e6eaf1", overflow: "hidden" }}>
        <DataGrid<TestUser>
          data={rows}
          columns={columns}
          title="Test Grid"
          mainColumns="name"
          getRowId={(u) => u.id}
          maxHeight={620}
          className="w-full"

          // Selection
          enableRowSelection
          selectedRowIds={selectedUserIds}
          onRowSelect={onRowSelect}
          rowSelectionMode="multi"
          enableRowClickSelection
          enableCtrlClickMultiSelect
          enableShiftClickRange

          // View toggle (all / selected)
          enableViewToggle
          viewMode={userViewMode}
          onViewModeChange={setUserViewMode}

          // Columns
          enableColumnResizing
          enableColumnReordering
          enableColumnFreezing
          enableColumnVisibility
          enableVirtualization

          // Rows
          enableRowReordering
          onRowOrderChange={handleRowReorder}

          // Search & filtering
          enableSearch
          enableBacchaSearch
          enableFilterRow

          // Data tools
          enableExport
          enableImport
          onImport={handleImport}
          enableVisualization

          // Summary / aggregation row
          enableSummary
          summaryConfig={{
            columns: {
              name: { type: "count", label: "Total:" },
              salary: { type: "sum", label: "Total:", format: (v) => `₹${v.toLocaleString("en-IN")}` },
              performance: {
                type: "custom",
                label: "Avg:",
                customFn: (data: TestUser[]) => {
                  if (!data.length) return "0%";
                  const avg = data.reduce((sum, item) => sum + item.performance, 0) / data.length;
                  if (avg >= 90) return `${avg.toFixed(1)}% (Excellent)`;
                  if (avg >= 80) return `${avg.toFixed(1)}% (Good)`;
                  return `${avg.toFixed(1)}%`;
                },
              },
              projectsCompleted: { type: "sum", label: "Total:" },
            },
          }}
        />
      </div>
      <AlertComponent />
    </div>
  );
}
