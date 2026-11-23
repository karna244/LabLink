import type { Booking, BookingStatus, Equipment } from '../types';
import { formatHour12 } from './timeFormat';

export interface ConflictCluster {
  key: string;
  equipmentId: string;
  equipmentName: string;
  date: string;
  bookings: Booking[];
}

export interface DepartmentUtilizationRow {
  department: string;
  count: number;
  avgUtil: number;
  bookedHours: number;
  conflicts: number;
}

export interface RebalancingInsight {
  overloaded: Equipment[];
  underutilized: Equipment[];
  recommendation: string;
}

const INACTIVE_STATUSES = new Set<BookingStatus>(['cancelled', 'rejected']);

/**
 * Returns true if two active bookings target the same equipment on the same date
 * with overlapping hour intervals [startHour, endHour).
 */
export function isBookingOverlap(
  a: Pick<Booking, 'equipmentId' | 'date' | 'startHour' | 'endHour' | 'status'>,
  b: Pick<Booking, 'equipmentId' | 'date' | 'startHour' | 'endHour' | 'status'>
): boolean {
  if (INACTIVE_STATUSES.has(a.status) || INACTIVE_STATUSES.has(b.status)) return false;
  if (a.equipmentId !== b.equipmentId || a.date !== b.date) return false;
  return a.startHour < b.endHour && b.startHour < a.endHour;
}

/**
 * Groups overlapping active bookings by (equipmentId, date) for faculty arbitration.
 */
export function findConflictClusters(bookings: Booking[]): ConflictCluster[] {
  const byEquipDate = new Map<string, Booking[]>();

  for (const b of bookings) {
    if (INACTIVE_STATUSES.has(b.status)) continue;
    const key = `${b.equipmentId}__${b.date}`;
    const list = byEquipDate.get(key) ?? [];
    list.push(b);
    byEquipDate.set(key, list);
  }

  const clusters: ConflictCluster[] = [];
  for (const [key, list] of byEquipDate.entries()) {
    if (list.length < 2) continue;
    const conflictingSet = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (isBookingOverlap(list[i], list[j])) {
          conflictingSet.add(list[i].id);
          conflictingSet.add(list[j].id);
        }
      }
    }

    if (conflictingSet.size >= 2) {
      const items = list
        .filter((b) => conflictingSet.has(b.id))
        .sort((a, b) => a.startHour - b.startHour);
      clusters.push({
        key,
        equipmentId: items[0].equipmentId,
        equipmentName: items[0].equipmentName,
        date: items[0].date,
        bookings: items,
      });
    }
  }

  return clusters;
}

/**
 * Indexes bookings for a single day into O(1) lookup keys `${equipmentId}__${hour}`
 * so schedule matrix rendering stays O(B + E*H) instead of O(E*H*B).
 */
export function buildScheduleLookup(dayBookings: Booking[]): {
  byEquip: Map<string, Booking[]>;
  byEquipHour: Map<string, Booking[]>;
} {
  const byEquip = new Map<string, Booking[]>();
  const byEquipHour = new Map<string, Booking[]>();

  for (const b of dayBookings) {
    if (INACTIVE_STATUSES.has(b.status)) continue;
    const eqList = byEquip.get(b.equipmentId) ?? [];
    eqList.push(b);
    byEquip.set(b.equipmentId, eqList);

    const start = Math.max(8, b.startHour);
    const end = Math.min(21, b.endHour);
    for (let h = start; h < end; h++) {
      const cellKey = `${b.equipmentId}__${h}`;
      const cellList = byEquipHour.get(cellKey) ?? [];
      cellList.push(b);
      byEquipHour.set(cellKey, cellList);
    }
  }

  for (const list of byEquip.values()) {
    list.sort((a, b) => a.startHour - b.startHour);
  }

  return { byEquip, byEquipHour };
}

/**
 * Finds the earliest conflict-free [startHour, startHour + duration] window on `date`
 * within operating hours (8:00 AM - 9:00 PM). Returns null if the day is full.
 */
export function findNextOpenSlot(
  equipmentId: string,
  bookings: Booking[],
  date: string,
  durationHours = 1
): { startHour: number; endHour: number } | null {
  const span = Math.max(1, Math.min(8, Math.floor(durationHours)));
  const occupiedHours = new Set<number>();

  for (const b of bookings) {
    if (b.equipmentId !== equipmentId || b.date !== date) continue;
    if (INACTIVE_STATUSES.has(b.status)) continue;
    for (let h = b.startHour; h < b.endHour; h++) {
      occupiedHours.add(h);
    }
  }

  for (let start = 8; start <= 21 - span; start++) {
    let free = true;
    for (let h = start; h < start + span; h++) {
      if (occupiedHours.has(h)) {
        free = false;
        break;
      }
    }
    if (free) {
      return { startHour: start, endHour: start + span };
    }
  }

  return null;
}

/**
 * Computes human-readable 12-hour next-open labels for every equipment item in O(E + B).
 */
export function computeNextOpenByEquipment(
  equipmentList: Equipment[],
  bookings: Booking[],
  todayDate: string
): Map<string, string> {
  const occupiedByEquip = new Map<string, Set<number>>();

  for (const b of bookings) {
    if (b.date !== todayDate || INACTIVE_STATUSES.has(b.status)) continue;
    const set = occupiedByEquip.get(b.equipmentId) ?? new Set<number>();
    for (let h = b.startHour; h < b.endHour; h++) {
      set.add(h);
    }
    occupiedByEquip.set(b.equipmentId, set);
  }

  const labels = new Map<string, string>();
  for (const item of equipmentList) {
    if (item.status === 'maintenance') {
      labels.set(item.id, 'Under calibration');
      continue;
    }
    const occupied = occupiedByEquip.get(item.id);
    let foundHour: number | null = null;
    for (let h = 8; h <= 20; h++) {
      if (!occupied || !occupied.has(h)) {
        foundHour = h;
        break;
      }
    }
    labels.set(
      item.id,
      foundHour !== null
        ? `Next open today: ${formatHour12(foundHour)}`
        : 'Today full · Tomorrow 8:00 AM'
    );
  }

  return labels;
}

/**
 * Aggregates department utilization & optimization insights in O(E + B).
 */
export function computeUtilizationInsights(
  equipmentList: Equipment[],
  bookings: Booking[]
): {
  deptStats: DepartmentUtilizationRow[];
  rebalancing: RebalancingInsight;
} {
  const equipMap = new Map<string, Equipment>();
  const deptMap = new Map<
    string,
    {
      department: string;
      count: number;
      totalUtil: number;
      bookedHours: number;
      conflicts: number;
    }
  >();

  for (const eq of equipmentList) {
    equipMap.set(eq.id, eq);
    const entry = deptMap.get(eq.department) ?? {
      department: eq.department,
      count: 0,
      totalUtil: 0,
      bookedHours: 0,
      conflicts: 0,
    };
    entry.count += 1;
    entry.totalUtil += eq.utilizationRate;
    deptMap.set(eq.department, entry);
  }

  for (const bk of bookings) {
    if (INACTIVE_STATUSES.has(bk.status)) continue;
    const eq = equipMap.get(bk.equipmentId);
    const dept = eq?.department ?? bk.department;
    const entry = deptMap.get(dept);
    if (entry) {
      entry.bookedHours += Math.max(1, bk.endHour - bk.startHour);
      if (bk.status === 'conflict_flagged') entry.conflicts += 1;
    }
  }

  const deptStats: DepartmentUtilizationRow[] = Array.from(deptMap.values()).map((d) => ({
    department: d.department,
    count: d.count,
    avgUtil: d.count > 0 ? Math.round(d.totalUtil / d.count) : 0,
    bookedHours: d.bookedHours,
    conflicts: d.conflicts,
  }));

  const overloaded = equipmentList
    .filter((e) => e.status !== 'maintenance' && e.utilizationRate >= 80)
    .sort((a, b) => b.utilizationRate - a.utilizationRate);
  const underutilized = equipmentList
    .filter((e) => e.status === 'available' && e.utilizationRate <= 65)
    .sort((a, b) => a.utilizationRate - b.utilizationRate);

  let recommendation = 'Campus equipment capacity is balanced across departments.';
  if (overloaded.length > 0 && underutilized.length > 0) {
    recommendation = `Shift non-urgent coursework runs from ${overloaded[0].name} (${overloaded[0].utilizationRate}% load) toward ${underutilized[0].name} (${underutilized[0].utilizationRate}% load) or off-peak 8:00 AM – 11:00 AM windows.`;
  }

  return {
    deptStats,
    rebalancing: { overloaded, underutilized, recommendation },
  };
}
