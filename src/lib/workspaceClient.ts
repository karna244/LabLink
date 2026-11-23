import {
  buildSeedBookings,
  buildSeedProjectRequests,
  SEED_EQUIPMENT,
} from '../data/seedData';
import type { Booking, Equipment, ProjectRequest } from '../types';
import { formatHour12 } from './timeFormat';

export interface WorkspacePayload {
  equipment: Equipment[];
  bookings: Booking[];
  projectRequests: ProjectRequest[];
}

const STATIC_STORE_KEY = 'labgrid_static_workspace_v1';

function readLocalStore(): WorkspacePayload {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STATIC_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WorkspacePayload>;
        if (
          Array.isArray(parsed.equipment) &&
          Array.isArray(parsed.bookings) &&
          Array.isArray(parsed.projectRequests)
        ) {
          return {
            equipment: parsed.equipment,
            bookings: parsed.bookings,
            projectRequests: parsed.projectRequests,
          };
        }
      }
    } catch {
      // ignore corrupted local storage
    }
  }
  return {
    equipment: SEED_EQUIPMENT,
    bookings: buildSeedBookings(),
    projectRequests: buildSeedProjectRequests(),
  };
}

function writeLocalStore(payload: WorkspacePayload): WorkspacePayload {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STATIC_STORE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }
  return payload;
}

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

export async function fetchWorkspaceState(): Promise<WorkspacePayload> {
  try {
    const res = await fetch('/api/workspace');
    if (res.ok && isJsonResponse(res)) {
      return (await res.json()) as WorkspacePayload;
    }
  } catch {
    // static hosting fallback
  }
  return readLocalStore();
}

export async function saveWorkspaceState(payload: WorkspacePayload): Promise<WorkspacePayload> {
  try {
    const res = await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok && isJsonResponse(res)) {
      return (await res.json()) as WorkspacePayload;
    }
    if (res.status !== 404 && res.status !== 405) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to save workspace changes.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Failed to save')) {
      throw err;
    }
  }
  return writeLocalStore(payload);
}

export async function resetWorkspaceState(): Promise<WorkspacePayload> {
  try {
    const res = await fetch('/api/workspace/reset', { method: 'POST' });
    if (res.ok && isJsonResponse(res)) {
      return (await res.json()) as WorkspacePayload;
    }
  } catch {
    // static hosting fallback
  }
  return writeLocalStore({
    equipment: SEED_EQUIPMENT,
    bookings: buildSeedBookings(),
    projectRequests: buildSeedProjectRequests(),
  });
}

export function exportBookingsToCsv(bookings: Booking[]): void {
  const headers = [
    'Booking ID',
    'Equipment',
    'Department',
    'Project Title',
    'Researcher',
    'Date',
    'Start Time',
    'End Time',
    'Priority',
    'Project Deadline',
    'Status',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = bookings.map((b) =>
    [
      b.id,
      b.equipmentName,
      b.department,
      b.projectTitle,
      b.requesterName,
      b.date,
      formatHour12(b.startHour),
      formatHour12(b.endHour),
      b.priorityLevel,
      b.projectDeadline,
      b.status,
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `labgrid-schedule-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
