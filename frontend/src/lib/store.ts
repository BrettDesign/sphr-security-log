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
  door_checks?: Record<string, boolean>;
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

export async function saveShift(shift: Shift): Promise<boolean> {
  return storage.setItem(SHIFT_KEY, JSON.stringify(shift));
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
    door_checks: shift.door_checks || {},
  };
}

// Best-effort sync. Returns true if the report reached the backend.
// IMPORTANT: never write the passed-in (possibly stale) snapshot back to
// storage — a slow sync could otherwise clobber newer entries added in the
// meantime. We re-read the latest shift and only flip the `synced` flag.
export async function syncShift(shift: Shift): Promise<boolean> {
  try {
    await api.saveReport(toReport(shift));
    const current = await getShift();
    if (
      current &&
      current.id === shift.id &&
      current.entries.length === shift.entries.length
    ) {
      // Everything that's stored has now been synced.
      await saveShift({ ...current, synced: true });
    }
    // If newer entries were added while syncing, leave them marked unsynced;
    // their own syncShift call will reconcile.
    return true;
  } catch {
    const current = await getShift();
    if (current && current.id === shift.id) {
      await saveShift({ ...current, synced: false });
    }
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
