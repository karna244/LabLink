import { useMemo } from 'react';
import type { Booking, Equipment, ProjectRequest } from '../types';
import { computeUtilizationInsights, findConflictClusters } from '../lib/scheduling';
import { formatHour12, formatHour12Short } from '../lib/timeFormat';

interface UtilizationViewProps {
  equipmentList: Equipment[];
  bookings: Booking[];
  projectRequests: ProjectRequest[];
}

const HOURS = Array.from({ length: 13 }, (_, idx) => idx + 8); // 8..20

export function UtilizationView({
  equipmentList,
  bookings,
  projectRequests,
}: UtilizationViewProps) {
  const conflictClusters = useMemo(() => findConflictClusters(bookings), [bookings]);

  const { deptStats, rebalancing } = useMemo(
    () => computeUtilizationInsights(equipmentList, bookings),
    [equipmentList, bookings]
  );

  const { hourlyDemand, priorityBreakdown } = useMemo(() => {
    const hourCounts = new Map<number, number>();
    const tierCounts = {
      thesis_deadline: 0,
      funded_grant: 0,
      capstone: 0,
      standard: 0,
    };
    let activeTotal = 0;

    for (const b of bookings) {
      if (b.status === 'cancelled' || b.status === 'rejected') continue;
      activeTotal += 1;
      tierCounts[b.priorityLevel] = (tierCounts[b.priorityLevel] || 0) + 1;
      const start = Math.max(8, b.startHour);
      const end = Math.min(21, b.endHour);
      for (let h = start; h < end; h++) {
        hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
      }
    }

    const counts = HOURS.map((hour) => ({
      hour,
      count: hourCounts.get(hour) || 0,
    }));
    const maxCount = Math.max(1, ...counts.map((c) => c.count));

    const tiers = [
      { key: 'thesis_deadline', label: 'Thesis Defense Deadline' },
      { key: 'funded_grant', label: 'Funded Research Grant' },
      { key: 'capstone', label: 'Senior Capstone' },
      { key: 'standard', label: 'Standard Coursework' },
    ] as const;

    const breakdown = tiers.map((tier) => {
      const count = tierCounts[tier.key];
      const pct = activeTotal > 0 ? Math.round((count / activeTotal) * 100) : 0;
      return { ...tier, count, pct };
    });

    return {
      hourlyDemand: { counts, maxCount },
      priorityBreakdown: breakdown,
    };
  }, [bookings]);

  const rescheduledCount = useMemo(
    () => bookings.filter((b) => b.status === 'rescheduled').length,
    [bookings]
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <p className="text-xs font-semibold text-indigo-700 mb-1">
          Faculty Analytics & Capacity Telemetry
        </p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Resource Utilization & Allocation Telemetry
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Live cross-department capacity distribution, peak 12-hour booking demand, and AI conflict arbitration metrics across campus laboratories.
        </p>
      </div>

      {/* Top 4-column Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Total Scheduled Hours</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {deptStats.reduce((acc, d) => acc + d.bookedHours, 0)}h
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Confirmed / Reallocated</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-700 mt-1">
            {bookings.filter((b) => b.status === 'confirmed' || b.status === 'rescheduled').length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {rescheduledCount} AI-optimized slot(s)
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Approved Multi-Lab Projects</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {projectRequests.filter((p) => p.status === 'approved').length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Contended Slot Clusters</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-amber-700 mt-1">
            {conflictClusters.length}
          </p>
        </div>
      </section>

      {/* Capacity Optimization Recommendation */}
      <section className="bg-white border border-indigo-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-indigo-700">
            Resource Utilization Optimization
          </p>
          <p className="text-sm font-medium text-slate-900">
            {rebalancing.recommendation}
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
          {rebalancing.overloaded.length} high-load · {rebalancing.underutilized.length} open capacity
        </div>
      </section>

      {/* Hourly Load + Priority Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Hourly Demand Distribution (8:00 AM – 8:00 PM)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Concurrent active instrument reservations per operating hour
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-4 border-b border-slate-200 pb-2">
                {hourlyDemand.counts.map((slot) => {
                  const heightPct = Math.round((slot.count / hourlyDemand.maxCount) * 100);
                  return (
                    <div key={slot.hour} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[11px] font-mono tabular-nums text-slate-600">
                        {slot.count}
                      </span>
                      <div
                        style={{ height: `${Math.max(8, heightPct)}%` }}
                        className={`w-full rounded-t transition-all ${
                          slot.count >= 2 ? 'bg-indigo-700' : slot.count === 1 ? 'bg-indigo-500' : 'bg-slate-100'
                        }`}
                        title={`${formatHour12(slot.hour)} — ${slot.count} active reservation(s)`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500 pt-2">
                {hourlyDemand.counts.map((slot) => (
                  <span key={slot.hour} className="flex-1 text-center">
                    {formatHour12Short(slot.hour)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Allocation by Priority Tier
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Share of active slots across academic urgency tiers
            </p>
          </div>

          <div className="space-y-4">
            {priorityBreakdown.map((tier) => (
              <div key={tier.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{tier.label}</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {tier.count} ({tier.pct}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${tier.pct}%` }}
                    className="h-full bg-indigo-600 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Department Utilization Table & Mobile Cards */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Department Utilization Ledger
          </h2>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {deptStats.map((row) => (
            <div key={row.department} className="p-4 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{row.department}</span>
                <span className="font-mono tabular-nums font-semibold text-indigo-800">
                  {row.avgUtil}% avg
                </span>
              </div>
              <p className="font-mono tabular-nums text-slate-600">
                {row.count} resources · {row.bookedHours}h scheduled · {row.conflicts} conflicts
              </p>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-5">Department</th>
                <th className="py-3 px-5 text-right">Shared Instruments</th>
                <th className="py-3 px-5 text-right">Scheduled Hours</th>
                <th className="py-3 px-5 text-right">Avg. Utilization</th>
                <th className="py-3 px-5 text-right">Flagged Conflicts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {deptStats.map((row) => (
                <tr key={row.department} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5 font-medium text-slate-900">{row.department}</td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-700">
                    {row.count}
                  </td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-700">
                    {row.bookedHours}h
                  </td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-900 font-semibold">
                    {row.avgUtil}%
                  </td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-700">
                    {row.conflicts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
