import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Sparkles, X } from 'lucide-react';
import {
  FIELD_LIMITS,
  type AiSlotOption,
  type Booking,
  type Equipment,
  type PriorityLevel,
} from '../types';
import { formatLocalDateOffset, inferResourceType } from '../data/seedData';
import { aiRecommendSlot } from '../lib/aiClient';
import { findNextOpenSlot, isBookingOverlap } from '../lib/scheduling';
import { formatHour12, formatHour12Short, formatRange12 } from '../lib/timeFormat';
import { EquipmentImage } from './EquipmentImage';

export interface NewBookingInput {
  equipment: Equipment;
  projectTitle: string;
  purpose: string;
  date: string;
  startHour: number;
  endHour: number;
  priorityLevel: PriorityLevel;
  projectDeadline: string;
  aiNote?: string;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentList: Equipment[];
  initialEquipmentId?: string;
  initialDate?: string;
  initialStartHour?: number;
  bookings: Booking[];
  onCreateBooking: (input: NewBookingInput) => Promise<{ status: string; hasConflict: boolean }>;
  onBooked: (result: { status: string; hasConflict: boolean }) => void;
}

const HOURS = Array.from({ length: 13 }, (_, idx) => idx + 8);

export function BookingModal({
  isOpen,
  onClose,
  equipmentList,
  initialEquipmentId,
  initialDate,
  initialStartHour,
  bookings,
  onCreateBooking,
  onBooked,
}: BookingModalProps) {
  const [selectedEquipId, setSelectedEquipId] = useState(
    initialEquipmentId || equipmentList[0]?.id || ''
  );
  const [date, setDate] = useState(initialDate || formatLocalDateOffset(0));
  const [startHour, setStartHour] = useState(initialStartHour || 10);
  const [endHour, setEndHour] = useState((initialStartHour || 10) + 2);
  const [projectTitle, setProjectTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>('capstone');
  const [projectDeadline, setProjectDeadline] = useState(formatLocalDateOffset(7));

  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiOptions, setAiOptions] = useState<AiSlotOption[]>([]);
  const [aiNote, setAiNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedEquipId(initialEquipmentId || equipmentList[0]?.id || '');
    setDate(initialDate || formatLocalDateOffset(0));
    const start = initialStartHour || 10;
    setStartHour(start);
    setEndHour(Math.min(21, start + 2));
    setAiAnalysis('');
    setAiOptions([]);
    setAiNote('');
    setErrorMsg('');
  }, [isOpen, initialEquipmentId, initialDate, initialStartHour, equipmentList]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const selectedEquipment = useMemo(
    () => equipmentList.find((e) => e.id === selectedEquipId) || equipmentList[0],
    [equipmentList, selectedEquipId]
  );

  const dayBookings = useMemo(() => {
    if (!selectedEquipment) return [];
    return bookings.filter(
      (b) =>
        b.equipmentId === selectedEquipment.id &&
        b.date === date &&
        b.status !== 'cancelled' &&
        b.status !== 'rejected'
    );
  }, [bookings, selectedEquipment, date]);

  const liveOverlap = useMemo(() => {
    if (!selectedEquipment) return false;
    return dayBookings.some((b) =>
      isBookingOverlap(
        {
          equipmentId: selectedEquipment.id,
          date,
          startHour,
          endHour,
          status: 'pending_approval',
        },
        b
      )
    );
  }, [dayBookings, selectedEquipment, date, startHour, endHour]);

  const instantOpenSlot = useMemo(() => {
    if (!selectedEquipment || !liveOverlap) return null;
    const span = Math.max(1, Math.min(selectedEquipment.maxSlotHours, endHour - startHour));
    return findNextOpenSlot(selectedEquipment.id, bookings, date, span);
  }, [selectedEquipment, liveOverlap, bookings, date, startHour, endHour]);

  if (!isOpen || !selectedEquipment) return null;

  const handleAskAiSlot = async () => {
    setErrorMsg('');
    setAiLoading(true);
    try {
      const duration = Math.max(1, Math.min(selectedEquipment.maxSlotHours, endHour - startHour));
      const res = await aiRecommendSlot({
        equipment: selectedEquipment,
        requestedDate: date,
        durationHours: duration,
        projectDeadline,
        priorityLevel,
        existingBookings: bookings,
      });
      setAiAnalysis(res.analysis);
      setAiOptions(res.options || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to fetch AI slot recommendations.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiOption = (opt: AiSlotOption) => {
    setDate(opt.date);
    setStartHour(opt.startHour);
    setEndHour(opt.endHour);
    setAiNote(`AI-selected slot: ${opt.rationale}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEquipment.status === 'maintenance') {
      setErrorMsg('This instrument is currently undergoing calibration/maintenance.');
      return;
    }
    if (projectTitle.trim().length < 2 || purpose.trim().length < 4) {
      setErrorMsg('Please enter a project title and brief technical purpose.');
      return;
    }
    if (endHour <= startHour) {
      setErrorMsg('End hour must be later than start hour.');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);
    try {
      const result = await onCreateBooking({
        equipment: selectedEquipment,
        projectTitle,
        purpose,
        date,
        startHour,
        endHour,
        priorityLevel,
        projectDeadline,
        aiNote,
      });
      setProjectTitle('');
      setPurpose('');
      onBooked(result);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div>
            <h2 id="booking-modal-title" className="text-lg font-semibold text-slate-900">
              Inspect & Reserve Laboratory Resource
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {inferResourceType(selectedEquipment)} · {selectedEquipment.department} · {selectedEquipment.location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          {/* Selected Equipment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pb-5 border-b border-slate-200">
            <div className="md:col-span-4">
              <EquipmentImage
                src={selectedEquipment.imageUrl}
                alt={selectedEquipment.name}
                label={selectedEquipment.name}
                className="w-full aspect-4/3 object-cover rounded-lg border border-slate-200"
              />
            </div>
            <div className="md:col-span-8 space-y-2.5">
              <label className="block text-xs font-medium text-slate-600" htmlFor="modal-equip-select">
                Instrument or Workstation
              </label>
              <select
                id="modal-equip-select"
                value={selectedEquipment.id}
                onChange={(e) => setSelectedEquipId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.department})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-600 leading-relaxed">{selectedEquipment.description}</p>
              <p className="text-xs font-mono text-slate-600">{selectedEquipment.specs}</p>
              <p className="text-xs text-slate-600">
                Custodian: <span className="font-medium text-slate-900">{selectedEquipment.custodianName}</span> ·{' '}
                {selectedEquipment.requiresApproval
                  ? 'Faculty approval required'
                  : 'Auto-approved when slot is free'}{' '}
                · Max {selectedEquipment.maxSlotHours}h per slot
              </p>
            </div>
          </div>

          {/* Interactive 13-hour availability strip for selected date */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                Live Availability ({date} · 8:00 AM – 9:00 PM)
              </span>
              <span className="text-slate-500 flex items-center gap-3">
                <span className="text-slate-600">□ Open</span>
                <span className="text-amber-700 font-medium">▲ Occupied</span>
                <span className="text-teal-700 font-semibold">■ Selected</span>
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-[repeat(13,minmax(0,1fr))] gap-1.5">
              {HOURS.map((h) => {
                const occupied = dayBookings.some((b) => h >= b.startHour && h < b.endHour);
                const selected = h >= startHour && h < endHour;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      const span = Math.max(1, Math.min(selectedEquipment.maxSlotHours, endHour - startHour));
                      setStartHour(h);
                      setEndHour(Math.min(21, h + span));
                    }}
                    aria-label={`${formatHour12(h)} — ${occupied ? 'Occupied' : 'Open'}`}
                    title={formatHour12(h)}
                    className={`py-2 rounded text-[11px] font-mono tabular-nums border transition-colors min-h-[38px] ${
                      selected
                        ? 'bg-teal-700 text-white border-teal-700 font-semibold'
                        : occupied
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-500'
                    }`}
                  >
                    {formatHour12Short(h)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date, Duration & Time Slot Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label htmlFor="bk-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                Date
              </label>
              <input
                id="bk-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[40px]"
                required
              />
            </div>
            <div>
              <label htmlFor="bk-start" className="block text-xs font-medium text-slate-700 mb-1.5">
                Start Time
              </label>
              <select
                id="bk-start"
                value={startHour}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  const currentSpan = Math.max(1, Math.min(selectedEquipment.maxSlotHours, endHour - startHour));
                  setStartHour(next);
                  setEndHour(Math.min(21, next + currentSpan));
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[40px]"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {formatHour12(h)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bk-end" className="block text-xs font-medium text-slate-700 mb-1.5">
                End Time
              </label>
              <select
                id="bk-end"
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[40px]"
              >
                {Array.from({ length: 13 }, (_, idx) => idx + 9)
                  .filter((h) => h > startHour)
                  .map((h) => (
                    <option key={h} value={h}>
                      {formatHour12(h)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAskAiSlot}
                disabled={aiLoading}
                className="w-full px-3 py-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex items-center justify-center gap-1.5 min-h-[40px] disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiLoading ? 'Analyzing...' : 'AI Suggest Slot'}
              </button>
            </div>
          </div>

          {/* 1-click duration selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-600 mr-1">Quick duration:</span>
              {[1, 2, 3, 4]
                .filter((hrs) => hrs <= Math.max(1, selectedEquipment.maxSlotHours) && startHour + hrs <= 21)
                .map((hrs) => {
                  const isCurrent = endHour - startHour === hrs;
                  return (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setEndHour(Math.min(21, startHour + hrs))}
                      className={`px-2.5 py-1 rounded-md font-mono tabular-nums border transition-colors min-h-[32px] ${
                        isCurrent
                          ? 'bg-teal-700 text-white border-teal-700 font-semibold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-500'
                      }`}
                    >
                      {hrs}h
                    </button>
                  );
                })}
            </div>
            <span className="text-slate-500 font-mono tabular-nums">
              Max allowed: {selectedEquipment.maxSlotHours}h
            </span>
          </div>

          {selectedEquipment.status === 'maintenance' && (
            <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5">
              ✖ This instrument is currently undergoing scheduled maintenance. Please select another resource above.
            </p>
          )}

          {liveOverlap && (
            <div aria-live="polite" className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span>
                ▲ Overlaps an existing booking on {date}. Jump to a free slot or submit for faculty arbitration.
              </span>
              {instantOpenSlot && (
                <button
                  type="button"
                  onClick={() => {
                    setStartHour(instantOpenSlot.startHour);
                    setEndHour(instantOpenSlot.endHour);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-white border border-teal-300 rounded-md hover:bg-teal-50 whitespace-nowrap shrink-0"
                >
                  Use Open {formatRange12(instantOpenSlot.startHour, instantOpenSlot.endHour)}
                </button>
              )}
            </div>
          )}

          {/* AI Slot Recommendations */}
          {aiOptions.length > 0 && (
            <div className="bg-teal-50/60 border border-teal-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-slate-900">{aiAnalysis}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {aiOptions.map((opt, idx) => (
                  <button
                    key={`${opt.date}-${opt.startHour}-${idx}`}
                    type="button"
                    onClick={() => applyAiOption(opt)}
                    className="text-left p-3 bg-white border border-teal-200 rounded-lg hover:border-teal-600 transition-colors space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-mono tabular-nums font-semibold text-teal-700">
                      <span>{opt.date}</span>
                      <span>{formatRange12(opt.startHour, opt.endHour)}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-900">{opt.label}</p>
                    <p className="text-xs text-slate-600 line-clamp-2">{opt.rationale}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick-Fill Templates so booking takes 1 click */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-medium text-slate-600">Quick-fill sample:</span>
            <button
              type="button"
              onClick={() => {
                setProjectTitle(`Coursework Verification — ${selectedEquipment.category}`);
                setPriorityLevel('standard');
                setProjectDeadline(formatLocalDateOffset(14));
                setPurpose(`Standard lab calibration and measurement run using ${selectedEquipment.name}.`);
              }}
              className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors"
            >
              Coursework Lab
            </button>
            <button
              type="button"
              onClick={() => {
                setProjectTitle(`Senior Capstone Prototype Validation`);
                setPriorityLevel('capstone');
                setProjectDeadline(formatLocalDateOffset(7));
                setPurpose(`Subsystem integration testing and milestone demo validation on ${selectedEquipment.name}.`);
              }}
              className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors"
            >
              Capstone Milestone
            </button>
            <button
              type="button"
              onClick={() => {
                setProjectTitle(`M.S. Thesis Defense Benchmark Run`);
                setPriorityLevel('thesis_deadline');
                setProjectDeadline(formatLocalDateOffset(2));
                setPurpose(`Final experimental trials and data export required ahead of thesis committee review.`);
              }}
              className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors"
            >
              Thesis Defense
            </button>
          </div>

          {/* Project & Priority Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="bk-title" className="block text-xs font-medium text-slate-700 mb-1.5">
                Project or Experiment Title
              </label>
              <input
                id="bk-title"
                type="text"
                maxLength={FIELD_LIMITS.titleMax}
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g., Autonomous Quadrotor Optical Flow Calibration"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
            <div>
              <label htmlFor="bk-deadline" className="block text-xs font-medium text-slate-700 mb-1.5">
                Project Deadline
              </label>
              <input
                id="bk-deadline"
                type="date"
                value={projectDeadline}
                onChange={(e) => setProjectDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="bk-priority" className="block text-xs font-medium text-slate-700 mb-1.5">
                Priority Tier
              </label>
              <select
                id="bk-priority"
                value={priorityLevel}
                onChange={(e) => setPriorityLevel(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="standard">Standard Coursework</option>
                <option value="capstone">Senior Capstone</option>
                <option value="thesis_deadline">Thesis Defense Deadline</option>
                <option value="funded_grant">Funded Research Grant</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bk-purpose" className="block text-xs font-medium text-slate-700 mb-1.5">
                Technical Requirements & Safety Notes
              </label>
              <input
                id="bk-purpose"
                type="text"
                maxLength={FIELD_LIMITS.purposeMax}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Specify fixtures, compute memory, probes, or material specs needed."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500 flex items-center gap-1.5 font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              Selected: {formatRange12(startHour, endHour)} ({Math.max(1, endHour - startHour)}h)
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || selectedEquipment.status === 'maintenance'}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-60 min-h-[40px]"
              >
                {submitting
                  ? 'Submitting...'
                  : liveOverlap
                    ? 'Submit & Flag Conflict'
                    : selectedEquipment.requiresApproval
                      ? 'Request Approval'
                      : 'Confirm Slot'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
