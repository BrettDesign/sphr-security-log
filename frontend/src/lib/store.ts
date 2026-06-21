// Offline-first shift store. Persists the active shift + patrol entries locally,
// and best-effort syncs to the backend when online.
import { storage } from "@/src/utils/storage";
import { api, Report, PatrolEntry, Manager } from "@/src/lib/api";

const SHIFT_KEY = "sphr.active_shift";

export type Shift = {
  id: string;
  security_number: string;
  guard_name: string;
  shift_date: string;
  manager_name?: string | null;
  manager_mobile?: string | null;
  entries: PatrolEntry[];
  submitted: boolean;
  started_at: string;
  synced: boolean;
};

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getShift(): Promise<Shift | null> {
  const raw = await storage.getItem<string | null>(SHIFT_KEY, null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Shift;
  } catch {
    return null;
  }
}

export async function saveShift(shift: Shift): Promise<void> {
  await storage.setItem(SHIFT_KEY, JSON.stringify(shift));
}

export async function clearShift(): Promise<void> {
  await storage.removeItem(SHIFT_KEY);
}

function toReport(shift: Shift): Report {
  return {
    id: shift.id,
    security_number: shift.security_number,
    guard_name: shift.guard_name,
    shift_date: shift.shift_date,
    manager_name: shift.manager_name,
    manager_mobile: shift.manager_mobile,
    entries: shift.entries,
    submitted: shift.submitted,
  };
}

// Best-effort sync. Returns true if the report reached the backend.
export async function syncShift(shift: Shift): Promise<boolean> {
  try {
    await api.saveReport(toReport(shift));
    const updated = { ...shift, synced: true };
    await saveShift(updated);
    return true;
  } catch {
    const updated = { ...shift, synced: false };
    await saveShift(updated);
    return false;
  }
}

export async function fetchManagers(): Promise<Manager[]> {
  try {
    return await api.getManagers();
  } catch {
    return [];
  }
}
