import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { Booking, Equipment } from '../types';
import { formatLocalDateOffset } from '../data/seedData';
import { buildScheduleLookup } from '../lib/scheduling';
import { exportBookingsToCsv } from '../lib/workspaceClient';
import { formatHour12, formatHour12Short, formatRange12 } from '../lib/timeFormat';

interface ScheduleViewProps {
  equipmentList: Equipment[];
  bookings: Booking[];
  currentActorUid: string;
  isFacultyMode: boolean;
  accentColor?: 'teal' | 'indigo';
  onCancelBooking: (bookingId: string) => Promise<void>;
  onOpenBooking: (equipmentId: string, date: string, startHour: number) => void;
  onGoToApprovals: () => void;
}

const HOURS = Array.from({ length: 13 }, (_, idx) => idx + 8); // 8..20 (8 AM - 8 PM start)

function formatStatusLabel(status: Booking['status']) {
  switch (status) {
    case 'confirmed':
      return <span className="text-xs font-medium text-emerald-700">● Confirmed</span>;
    case 'rescheduled':
      return <span className="text-xs font-medium text-teal-700">● Rescheduled</span>;
    case 'pending_approval':
      return <span className="text-xs font-medium text-amber-700">▲ Pending Approval</span>;
    case 'conflict_flagged':
      return <span className="text-xs font-medium text-rose-700">✖ Conflict Flagged</span>;
    case 'rejected':
      return <span className="text-xs font-medium text-slate-500">✖ Rejected</span>;
    case 'cancelled':
      return <span className="text-xs font-medium text-slate-400">Cancelled</span>;
  }
}

export function ScheduleView({
  equipmentList,
  bookings,
  currentActorUid,
  isFacultyMode,
  accentColor = 'teal',
  onCancelBooking,
  onOpenBooking,
  onGoToApprovals,
}: ScheduleViewProps) {
  const [selectedDate, setSelectedDate] = useState(formatLocalDateOffset(0));
  const [statusFilter, setStatusFilter] = useState<'all' | 'mine' | 'conflicts'>('all');
  const [mobileViewMode, setMobileViewMode] = useState<'agenda' | 'grid'>('agenda');
  const [busyId, setBusyId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isIndigo = accentColor === 'indigo';
  const focusRingClass = isIndigo ? 'focus:ring-indigo-600' : 'focus:ring-teal-600';
  const linkClass = isIndigo
    ? 'text-indigo-700 hover:text-indigo-800'
    : 'text-teal-700 hover:text-teal-800';
  const openSlotHoverClass = isIndigo
    ? 'hover:border-indigo-600 hover:bg-indigo-50'
    : 'hover:border-teal-600 hover:bg-teal-50';

  const datePresets = useMemo(
    () => [
      { label: 'Today', date: formatLocalDateOffset(0) },
      { label: 'Tomorrow', date: formatLocalDateOffset(1) },
      { label: 'In 2 Days', date: formatLocalDateOffset(2) },
    ],
    []
  );

  const dayBookings = useMemo(() => {
    return bookings.filter(
      (b) => b.date === selectedDate && b.status !== 'cancelled' && b.status !== 'rejected'
    );
  }, [bookings, selectedDate]);

  const scheduleLookup = useMemo(() => buildScheduleLookup(dayBookings), [dayBookings]);

  const filteredList = useMemo(() => {
    return bookings
      .filter((b) => {
        if (statusFilter === 'mine' && b.requesterUid !== currentActorUid) return false;
        if (statusFilter === 'conflicts' && b.status !== 'conflict_flagged') return false;
        return true;
      })
      .sort((a, b) => {
        const isoCmp = (b.createdIso || '').localeCompare(a.createdIso || '');
        if (isoCmp !== 0) return isoCmp;
        return `${a.date}:${String(a.startHour).padStart(2, '0')}`.localeCompare(
          `${b.date}:${String(b.startHour).padStart(2, '0')}`
        );
      });
  }, [bookings, statusFilter, currentActorUid]);

  const handleCancel = async (id: string) => {
    setBusyId(id);
    setErrorMsg('');
    try {
      await onCancelBooking(id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to cancel reservation.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {isFacultyMode ? 'Master Department Timetable' : 'Real-Time Laboratory Schedule'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect hourly occupancy across departments (8:00 AM – 9:00 PM). Tap any open slot to reserve.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {datePresets.map((preset) => (
              <button
                key={preset.date}
                type="button"
                onClick={() => setSelectedDate(preset.date)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  selectedDate === preset.date
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="Select schedule date"
            className={`px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 ${focusRingClass} min-h-[38px]`}
          />

          <button
            type="button"
            onClick={() => exportBookingsToCsv(filteredList)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px]"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Hourly Timeline Matrix (with Mobile Agenda Switcher) */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
            Occupancy · {selectedDate} (8:00 AM – 9:00 PM)
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex md:hidden items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setMobileViewMode('agenda')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  mobileViewMode === 'agenda' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600'
                }`}
              >
                Day Agenda
              </button>
              <button
                type="button"
                onClick={() => setMobileViewMode('grid')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  mobileViewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600'
                }`}
              >
                Hour Grid
              </button>
            </div>

            <div className="hidden sm:flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="text-emerald-700 font-medium">● Confirmed</span>
              <span className="text-teal-700 font-medium">● Rescheduled</span>
              <span className="text-amber-700 font-medium">▲ Pending</span>
              <span className="text-rose-700 font-medium">✖ Conflict</span>
              <span className="text-slate-400">□ Open</span>
            </div>
          </div>
        </div>

        {/* Mobile Card Agenda View */}
        {mobileViewMode === 'agenda' && (
          <div className="md:hidden divide-y divide-slate-100">
            {equipmentList.map((eq) => {
              const eqBookings = scheduleLookup.byEquip.get(eq.id) ?? [];
              return (
                <div key={eq.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{eq.name}</p>
                      <p className="text-xs text-slate-500 truncate">{eq.location}</p>
                    </div>
                    {eq.status === 'maintenance' ? (
                      <span className="text-xs font-medium text-rose-700 shrink-0">Maintenance</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenBooking(eq.id, selectedDate, 10)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 shrink-0 min-h-[36px] ${linkClass}`}
                      >
                        Book Slot
                      </button>
                    )}
                  </div>
                  {eqBookings.length === 0 ? (
                    <p className="text-xs text-slate-500">All hours open (8:00 AM – 9:00 PM)</p>
                  ) : (
                    <div className="space-y-1.5">
                      {eqBookings.map((bk) => (
                        <div
                          key={bk.id}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{bk.projectTitle}</p>
                            <p className="font-mono tabular-nums text-slate-600">
                              {formatRange12(bk.startHour, bk.endHour)} · {bk.requesterName}
                            </p>
                          </div>
                          {formatStatusLabel(bk.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Full Hourly Matrix (always shown on md+, optional toggle on mobile) */}
        <div className={`${mobileViewMode === 'agenda' ? 'hidden md:block' : 'block'} overflow-x-auto`}>
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 py-2.5 px-4 text-xs font-semibold text-slate-700 w-56 sm:w-64 border-r border-slate-200">
                  Equipment
                </th>
                {HOURS.map((h) => (
                  <th
                    key={h}
                    className="py-2.5 px-1 text-center text-xs font-mono tabular-nums font-medium text-slate-600"
                  >
                    {formatHour12Short(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipmentList.map((eq) => {
                return (
                  <tr key={eq.id} className="hover:bg-slate-50/70">
                    <td className="sticky left-0 z-10 bg-white py-2.5 px-4 border-r border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate max-w-[190px] sm:max-w-[230px]">
                        {eq.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate max-w-[190px] sm:max-w-[230px]">
                        {eq.location}
                      </p>
                    </td>
                    {HOURS.map((hour) => {
                      const matches = scheduleLookup.byEquipHour.get(`${eq.id}__${hour}`) ?? [];
                      const hasConflict =
                        matches.length > 1 ||
                        matches.some((m) => m.status === 'conflict_flagged');
                      const primary = matches[0];

                      if (eq.status === 'maintenance') {
                        return (
                          <td key={hour} className="p-1">
                            <div
                              title="Under maintenance"
                              aria-label={`${eq.name} unavailable at ${formatHour12(hour)} due to maintenance`}
                              className="h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-mono text-slate-400"
                            >
                              —
                            </div>
                          </td>
                        );
                      }

                      if (!primary) {
                        return (
                          <td key={hour} className="p-1">
                            <button
                              type="button"
                              onClick={() => onOpenBooking(eq.id, selectedDate, hour)}
                              aria-label={`Reserve ${eq.name} at ${formatHour12(hour)}`}
                              title={`Reserve ${eq.name} at ${formatHour12(hour)}`}
                              className={`w-full h-9 rounded border border-dashed border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 ${focusRingClass} ${openSlotHoverClass}`}
                            />
                          </td>
                        );
                      }

                      const cellStyle = hasConflict
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : primary.status === 'pending_approval'
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : primary.status === 'rescheduled'
                            ? 'bg-teal-50 border-teal-300 text-teal-800'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-800';

                      return (
                        <td key={hour} className="p-1">
                          <button
                            type="button"
                            onClick={() =>
                              hasConflict
                                ? onGoToApprovals()
                                : onOpenBooking(eq.id, selectedDate, hour)
                            }
                            aria-label={`${primary.projectTitle} by ${primary.requesterName} (${formatRange12(primary.startHour, primary.endHour)})${hasConflict ? ' — conflict flagged, open arbitration' : ''}`}
                            title={`${primary.projectTitle} — ${primary.requesterName} (${formatRange12(primary.startHour, primary.endHour)})`}
                            className={`w-full h-9 rounded border text-[10px] font-mono font-medium truncate px-1 focus-visible:outline-none focus-visible:ring-2 ${focusRingClass} ${cellStyle}`}
                          >
                            {hasConflict ? '!' : primary.requesterName.split(' ')[0].slice(0, 4)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reservations Ledger Table & Mobile Cards */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">All Reservations</h2>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'all', label: 'All Bookings' },
              { id: 'mine', label: isFacultyMode ? 'My Entries' : 'My Bookings' },
              { id: 'conflicts', label: 'Conflicts' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as 'all' | 'mine' | 'conflicts')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="m-4 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        {filteredList.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">No reservations match this filter.</p>
            <p className="text-xs text-slate-500">
              Select an open slot in the schedule above to create a reservation.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredList.map((bk) => {
                const canCancel =
                  (isFacultyMode || bk.requesterUid === currentActorUid) &&
                  bk.status !== 'cancelled' &&
                  bk.status !== 'rejected';
                return (
                  <div key={bk.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{bk.projectTitle}</p>
                        <p className="text-slate-600">{bk.equipmentName}</p>
                      </div>
                      {formatStatusLabel(bk.status)}
                    </div>
                    <p className="text-slate-500">
                      {bk.requesterName} · {bk.priorityLevel.replace('_', ' ')}
                    </p>
                    <p className="font-mono tabular-nums text-slate-700">
                      {bk.date} · {formatRange12(bk.startHour, bk.endHour)} · Deadline {bk.projectDeadline}
                    </p>
                    {bk.aiRecommendationNote && (
                      <p className={isIndigo ? 'text-indigo-800' : 'text-teal-800'}>
                        {bk.aiRecommendationNote}
                      </p>
                    )}
                    {canCancel && (
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={busyId === bk.id}
                          onClick={() => void handleCancel(bk.id)}
                          className="text-xs font-medium text-rose-700 hover:text-rose-800 disabled:opacity-50"
                        >
                          {busyId === bk.id ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Equipment</th>
                    <th className="py-2.5 px-4">Project & Researcher</th>
                    <th className="py-2.5 px-4">Date & Window</th>
                    <th className="py-2.5 px-4">Deadline</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredList.map((bk) => {
                    const canCancel =
                      (isFacultyMode || bk.requesterUid === currentActorUid) &&
                      bk.status !== 'cancelled' &&
                      bk.status !== 'rejected';
                    return (
                      <tr key={bk.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {bk.equipmentName}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{bk.projectTitle}</p>
                          <p className="text-slate-500">
                            {bk.requesterName} · {bk.priorityLevel.replace('_', ' ')}
                          </p>
                          {bk.aiRecommendationNote && (
                            <p className={`text-[11px] mt-0.5 max-w-md ${isIndigo ? 'text-indigo-800' : 'text-teal-800'}`}>
                              {bk.aiRecommendationNote}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {bk.date} · {formatRange12(bk.startHour, bk.endHour)}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {bk.projectDeadline}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatStatusLabel(bk.status)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {canCancel ? (
                            <button
                              type="button"
                              disabled={busyId === bk.id}
                              onClick={() => void handleCancel(bk.id)}
                              className="text-xs font-medium text-rose-700 hover:text-rose-800 disabled:opacity-50"
                            >
                              {busyId === bk.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          ) : bk.status === 'conflict_flagged' ? (
                            <button
                              type="button"
                              onClick={onGoToApprovals}
                              className={`text-xs font-medium ${linkClass}`}
                            >
                              View Arbitration
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
