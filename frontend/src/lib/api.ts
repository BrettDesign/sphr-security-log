// Backend API client. Base URL comes from env — never hardcoded.
// Accepts: a full URL (https://api.example.com), a bare host (api.example.com,
// as provided by Render's service linking) which we upgrade to https://, or an
// empty value (same-origin, e.g. when served behind nginx/Caddy).
function normalizeBase(raw?: string): string {
  const b = (raw || "").trim();
  if (!b) return "";
  const withScheme = /^https?:\/\//i.test(b) ? b : `https://${b}`;
  return withScheme.replace(/\/+$/, "");
}
const BASE = normalizeBase(process.env.EXPO_PUBLIC_BACKEND_URL);

export type Manager = {
  id: string;
  name: string;
  mobile: string;
};

export type PatrolEntry = {
  id: string;
  location: string;
  action: string;
  timestamp: string;
  time_label?: string;
  latitude?: number | null;
  longitude?: number | null;
  photo?: string | null;
};

export type Report = {
  id: string;
  security_number: string;
  guard_name: string;
  shift_date: string;
  manager_name?: string | null;
  manager_mobile?: string | null;
  entries: PatrolEntry[];
  submitted: boolean;
  door_checks?: Record<string, boolean>;
};

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getManagers: () => req<Manager[]>("/managers"),
  addManager: (name: string, mobile: string) =>
    req<Manager>("/managers", {
      method: "POST",
      body: JSON.stringify({ name, mobile }),
    }),
  updateManager: (id: string, name: string, mobile: string) =>
    req<Manager>(`/managers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, mobile }),
    }),
  deleteManager: (id: string) =>
    req<{ deleted: string }>(`/managers/${id}`, { method: "DELETE" }),
  saveReport: (report: Report) =>
    req<Report>("/reports", {
      method: "POST",
      body: JSON.stringify(report),
    }),
  sendReport: (report: Report) =>
    req<{ sent: boolean; recipient: string; pdf_attached: boolean; message: string }>(
      "/reports/send",
      {
        method: "POST",
        body: JSON.stringify(report),
      }
    ),
};
