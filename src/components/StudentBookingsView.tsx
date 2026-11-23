import { useMemo, useState } from 'react';
import { Award, CalendarClock, ShieldCheck, Sparkles } from 'lucide-react';
import type { AiResolveConflictResponse, Booking, Equipment } from '../types';
import { aiResolveConflict } from '../lib/aiClient';
import { findConflictClusters } from '../lib/scheduling';
import { formatRange12 } from '../lib/timeFormat';

interface StudentBookingsViewProps {
  studentName: string;
  studentUid: string;
  bookings: Booking[];
  equipmentList: Equipment[];
  onCancelBooking: (bookingId: string) => Promise<void>;
  onOpenNewBooking: () => void;
  onShiftOwnBooking: (
    bookingId: string,
    newDate: string,
    newStartHour: number,
    newEndHour: number,
    note: string
  ) => Promise<void>;
}

function formatBookingBadge(status: Booking['status']) {
  switch (status) {
    case 'confirmed':
      return <span className="text-xs font-medium text-emerald-700">● Confirmed</span>;
    case 'rescheduled':
      return <span className="text-xs font-medium text-teal-700">● Rescheduled</span>;
    case 'pending_approval':
      return <span className="text-xs font-medium text-amber-700">▲ Awaiting Faculty</span>;
    case 'conflict_flagged':
      return <span className="text-xs font-medium text-rose-700">✖ Time Conflict</span>;
    case 'rejected':
      return <span className="text-xs font-medium text-slate-500">✖ Declined</span>;
    case 'cancelled':
      return <span className="text-xs font-medium text-slate-400">Cancelled</span>;
  }
}

export function StudentBookingsView({
  studentName,
  studentUid,
  bookings,
  equipmentList,
  onCancelBooking,
  onOpenNewBooking,
  onShiftOwnBooking,
}: StudentBookingsViewProps) {
  const [busyId, setBusyId] = useState('');
  const [aiPlanByCluster, setAiPlanByCluster] = useState<
    Record<string, AiResolveConflictResponse>
  >({});
  const [resolvingKey, setResolvingKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Show student's own bookings newest-first (fallback to seeded demo student rows if none yet)
  const myBookings = useMemo(() => {
    const owned = bookings.filter((b) => b.requesterUid === studentUid);
    const list =
      owned.length > 0
        ? [...owned]
        : bookings.filter((b) => b.requesterUid.startsWith('demo-student-'));
    return list.sort((a, b) => (b.createdIso || '').localeCompare(a.createdIso || ''));
  }, [bookings, studentUid]);

  const conflictClusters = useMemo(() => findConflictClusters(bookings), [bookings]);

  const myClusters = useMemo(() => {
    const myIds = new Set(myBookings.map((b) => b.id));
    return conflictClusters.filter((c) => c.bookings.some((b) => myIds.has(b.id)));
  }, [conflictClusters, myBookings]);

  const equipmentById = useMemo(
    () => new Map(equipmentList.map((e) => [e.id, e])),
    [equipmentList]
  );

  const handleGetAiReschedule = async (clusterKey: string) => {
    const cluster = conflictClusters.find((c) => c.key === clusterKey);
    if (!cluster) return;
    const eq = equipmentById.get(cluster.equipmentId);
    if (!eq) return;

    setErrorMsg('');
    setResolvingKey(clusterKey);
    try {
      const plan = await aiResolveConflict({
        equipment: eq,
        conflictingBookings: cluster.bookings,
        allEquipment: equipmentList,
        allBookings: bookings,
      });
      setAiPlanByCluster((prev) => ({ ...prev, [clusterKey]: plan }));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to generate reschedule options.'
      );
    } finally {
      setResolvingKey('');
    }
  };

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
    <div className="space-y-8">
      {/* Light Academic Student Record Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-1.5">
          <p className="text-xs font-semibold text-teal-700">
            Student Academic Record · School of Engineering & Applied Sciences
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {studentName}
          </h1>
          <p className="text-sm text-slate-600">
            M.S. Robotics & Autonomous Systems · Advisor: Prof. Marcus Vance · Fall Term 2026
          </p>
        </div>

        <div className="lg:col-span-5 grid grid-cols-2 gap-4 text-xs bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="space-y-1">
            <p className="text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
              Verified Clearances
            </p>
            <p className="font-semibold text-slate-900">ESD Level 2 · ROS 2 Cobot</p>
          </div>
          <div className="space-y-1">
            <p className="text-slate-500 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-teal-700" />
              Course Allocation
            </p>
            <p className="font-mono tabular-nums font-semibold text-slate-900">
              12h / week quota
            </p>
          </div>
        </div>
      </section>

      {/* Student Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Confirmed Slots</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-700 mt-1">
            {myBookings.filter((b) => b.status === 'confirmed' || b.status === 'rescheduled').length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Pending Faculty Review</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-amber-700 mt-1">
            {myBookings.filter((b) => b.status === 'pending_approval').length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Schedule Conflicts</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-rose-700 mt-1">
            {myBookings.filter((b) => b.status === 'conflict_flagged').length}
          </p>
        </div>
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">New Lab Session</p>
            <p className="text-xs text-slate-700 mt-1">Reserve an open bench</p>
          </div>
          <button
            type="button"
            onClick={onOpenNewBooking}
            className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
          >
            Reserve Slot
          </button>
        </div>
      </section>

      {errorMsg && (
        <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {errorMsg}
        </p>
      )}

      {/* Active Conflict Self-Service Advisory for Student */}
      {myClusters.length > 0 && (
        <section className="bg-white border border-amber-300 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Action Needed: Overlapping Lab Reservations
              </h2>
              <p className="text-xs text-slate-600">
                Request a GenAI alternative slot to avoid delays before your project deadline.
              </p>
            </div>
          </div>

          {myClusters.map((cluster) => {
            const plan = aiPlanByCluster[cluster.key];
            return (
              <div key={cluster.key} className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {cluster.equipmentName} · {cluster.date}
                    </p>
                    <p className="text-xs text-slate-600">
                      {cluster.bookings.length} student teams requested overlapping hours
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={resolvingKey === cluster.key}
                    onClick={() => void handleGetAiReschedule(cluster.key)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-600 inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {resolvingKey === cluster.key ? 'Finding Alternative...' : 'Find Alternative Slot'}
                  </button>
                </div>

                {plan && (
                  <div className="bg-white border border-teal-200 rounded-lg p-3.5 space-y-2.5">
                    <p className="text-xs text-slate-700">{plan.fairnessSummary}</p>
                    <div className="divide-y divide-slate-100">
                      {plan.actions.map((act) => (
                        <div
                          key={act.bookingId}
                          className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {act.requesterName} — {act.projectTitle}
                            </p>
                            <p className="text-slate-600">{act.explanation}</p>
                          </div>
                          {act.recommendedAction !== 'keep_primary' && (
                            <button
                              type="button"
                              onClick={() =>
                                void onShiftOwnBooking(
                                  act.bookingId,
                                  act.newDate,
                                  act.newStartHour,
                                  act.newEndHour,
                                  act.explanation
                                )
                              }
                              className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
                            >
                              Move to {act.newDate} · {formatRange12(act.newStartHour, act.newEndHour)}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Student Reservations List */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-teal-700" />
              My Laboratory Reservations
            </h2>
            {bookings.every((b) => b.requesterUid !== studentUid) && (
              <p className="text-xs text-slate-500 mt-0.5">
                Showing campus sample reservations. Click “Reserve Slot” above to submit your own booking.
              </p>
            )}
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {myBookings.length} booking(s)
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {myBookings.map((bk) => {
            const canCancel = bk.status !== 'cancelled' && bk.status !== 'rejected';
            return (
              <div
                key={bk.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-slate-900">{bk.projectTitle}</h3>
                    {formatBookingBadge(bk.status)}
                  </div>
                  <p className="text-xs text-slate-600">
                    {bk.equipmentName} · {bk.department}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-slate-600">
                    Slot: {bk.date} · {formatRange12(bk.startHour, bk.endHour)} · Deadline: {bk.projectDeadline}
                  </p>
                  {bk.aiRecommendationNote && (
                    <p className="text-xs text-teal-800 pt-0.5">{bk.aiRecommendationNote}</p>
                  )}
                </div>

                <div className="shrink-0">
                  {canCancel ? (
                    <button
                      type="button"
                      disabled={busyId === bk.id}
                      onClick={() => void handleCancel(bk.id)}
                      className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50"
                    >
                      {busyId === bk.id ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Closed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
