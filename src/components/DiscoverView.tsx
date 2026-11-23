import { useMemo, useState } from 'react';
import { ArrowRight, Building2, Clock3, RotateCcw, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import type { AiDiscoverResponse, Booking, Equipment, ResourceType } from '../types';
import { formatLocalDateOffset, inferResourceType } from '../data/seedData';
import { aiDiscoverEquipment } from '../lib/aiClient';
import { computeNextOpenByEquipment } from '../lib/scheduling';
import { EquipmentImage } from './EquipmentImage';

interface DiscoverViewProps {
  equipmentList: Equipment[];
  bookings: Booking[];
  conflictCount: number;
  onSelectBook: (equipmentId: string) => void;
  onGoToMyBookings: () => void;
}

const EXAMPLE_PROMPTS = [
  'Train a surgical vision transformer and benchmark edge inference latency before Friday',
  'Machine custom aluminum gripper brackets and inspect surface micro-fractures',
  'Verify FPGA SPI controller timing jitter with a 4GHz oscilloscope today',
];

const RESOURCE_TYPES: ('All' | ResourceType)[] = [
  'All',
  'Equipment',
  'Development Kit',
  'Workstation',
];

function renderEquipmentStatus(status: Equipment['status']) {
  if (status === 'available') {
    return <span className="text-xs font-medium text-emerald-700">● Available</span>;
  }
  if (status === 'in_use') {
    return <span className="text-xs font-medium text-amber-700">▲ In Use</span>;
  }
  return <span className="text-xs font-medium text-rose-700">✖ Maintenance</span>;
}

export function DiscoverView({
  equipmentList,
  bookings,
  conflictCount,
  onSelectBook,
  onGoToMyBookings,
}: DiscoverViewProps) {
  const [nlQuery, setNlQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<AiDiscoverResponse | null>(null);

  const [deptFilter, setDeptFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState<'All' | ResourceType>('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'open_lab'>('all');
  const [keyword, setKeyword] = useState('');

  const hasActiveFilters =
    deptFilter !== 'All' ||
    typeFilter !== 'All' ||
    availabilityFilter !== 'all' ||
    keyword.trim().length > 0;

  const resetAllFilters = () => {
    setDeptFilter('All');
    setTypeFilter('All');
    setAvailabilityFilter('all');
    setKeyword('');
  };

  const departments = useMemo(() => {
    const unique = Array.from(new Set(equipmentList.map((e) => e.department)));
    return ['All', ...unique];
  }, [equipmentList]);

  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((item) => {
      const rType = inferResourceType(item);
      if (deptFilter !== 'All' && item.department !== deptFilter) return false;
      if (typeFilter !== 'All' && rType !== typeFilter) return false;
      if (availabilityFilter === 'available' && item.status !== 'available') return false;
      if (availabilityFilter === 'open_lab' && item.requiresApproval) return false;
      if (keyword.trim()) {
        const q = keyword.toLowerCase();
        const hay = `${item.name} ${rType} ${item.department} ${item.category} ${item.specs} ${item.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [equipmentList, deptFilter, typeFilter, availabilityFilter, keyword]);

  const avgUtilization = useMemo(() => {
    if (equipmentList.length === 0) return 0;
    const sum = equipmentList.reduce((acc, e) => acc + e.utilizationRate, 0);
    return Math.round(sum / equipmentList.length);
  }, [equipmentList]);

  const activeSlotsCount = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed' || b.status === 'rescheduled').length,
    [bookings]
  );

  const nextOpenByEquipId = useMemo(
    () => computeNextOpenByEquipment(equipmentList, bookings, formatLocalDateOffset(0)),
    [equipmentList, bookings]
  );

  const runAiDiscovery = async (customQuery?: string) => {
    const queryText = (customQuery ?? nlQuery).trim();
    if (queryText.length < 3) {
      setAiError('Describe your research task or required specs (at least 3 characters).');
      return;
    }
    if (customQuery !== undefined) {
      setNlQuery(customQuery);
    }
    setAiError('');
    setAiLoading(true);
    try {
      const result = await aiDiscoverEquipment({
        query: queryText,
        equipmentCatalog: equipmentList,
        currentBookings: bookings,
      });
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to complete AI equipment discovery.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runAiDiscovery();
  };

  return (
    <div className="space-y-8">
      {/* Crisp Light Academic Portal Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-teal-700 tracking-wide">
              Westbridge Institute of Technology · School of Engineering & Applied Sciences
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 text-balance leading-tight">
              Shared campus equipment, development kits, and lab workstations.
            </h1>
            <p className="text-sm lg:text-base text-slate-600 max-w-2xl leading-relaxed">
              Describe your coursework experiment, capstone prototype, or thesis workload. Find certified instruments across four departments and reserve 12-hour open lab slots from 8:00 AM – 9:00 PM.
            </p>
            <p className="text-xs text-slate-500 pt-1">
              <span className="font-semibold text-slate-700">1.</span> Describe goal or browse catalog{' '}
              <span aria-hidden="true" className="mx-1">·</span>{' '}
              <span className="font-semibold text-slate-700">2.</span> Pick an open 12-hour slot{' '}
              <span aria-hidden="true" className="mx-1">·</span>{' '}
              <span className="font-semibold text-slate-700">3.</span> Track faculty approval or AI conflict resolution
            </p>
          </div>

          <div className="space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  placeholder="Ask LabGrid AI: describe your experiment or required specs..."
                  aria-label="Natural-language equipment search"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white min-h-[44px]"
                />
              </div>
              <button
                type="submit"
                disabled={aiLoading}
                className="px-4 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {aiLoading ? 'Matching...' : 'Find Lab Equipment'}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Try a prompt:</span>
              {EXAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void runAiDiscovery(sample)}
                  className="text-left text-xs text-teal-700 hover:text-teal-900 underline underline-offset-2 decoration-teal-300 hover:decoration-teal-700 transition-colors"
                >
                  {sample}
                </button>
              ))}
            </div>

            {aiError && (
              <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {aiError}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="flex-1 min-h-[200px] bg-slate-100 overflow-hidden">
            <EquipmentImage
              src="/src/assets/images/hero_campus_lab_1795422989155.jpg"
              alt="Westbridge Interdisciplinary Engineering Laboratory Hall"
              label="Interdisciplinary Engineering Laboratory"
              priority
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/70 space-y-1">
            <p className="text-xs font-mono text-teal-700 tabular-nums font-medium">
              Fall Semester 2026 · Engineering Quad Buildings A–E
            </p>
            <p className="text-sm font-semibold text-slate-900">
              Open to certified B.Tech, M.S., and Ph.D. researchers across departments
            </p>
            <p className="text-xs text-slate-600">
              Mon–Sat · 8:00 AM – 9:00 PM · Cross-department project clearances active
            </p>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Live Campus Status Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Shared Resources</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {equipmentList.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {equipmentList.filter((e) => e.status === 'available').length} ready for booking
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Confirmed Sessions</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {activeSlotsCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">Active across 4 departments</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Weekly Capacity Load</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {avgUtilization}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Fall 2026 semester average</p>
        </div>
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Slot Collisions</p>
            <p
              className={`text-2xl font-semibold font-mono tabular-nums mt-1 ${
                conflictCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {conflictCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {conflictCount > 0 ? 'Pending alternative slots' : 'All slots clear'}
            </p>
          </div>
          {conflictCount > 0 && (
            <button
              type="button"
              onClick={onGoToMyBookings}
              className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
            >
              Check Status
            </button>
          )}
        </div>
      </section>

      {/* GenAI Discovery Results Panel */}
      {aiResult && (
        <section
          aria-live="polite"
          className="bg-white border border-teal-300 rounded-xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-teal-700">Academic Lab Advisor Match</p>
              <h2 className="text-lg font-semibold text-slate-900">{aiResult.interpretation}</h2>
              <p className="text-sm text-slate-600">{aiResult.workflowSummary}</p>
            </div>
            <button
              type="button"
              onClick={() => setAiResult(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Clear Results
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiResult.recommendations.map((rec) => (
              <div
                key={rec.equipmentId}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{rec.equipmentName}</h3>
                    <span className="text-xs font-mono tabular-nums font-semibold text-teal-700 shrink-0">
                      {rec.matchScore}% match
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rec.rationale}</p>
                  <p className="text-xs font-mono tabular-nums text-slate-700">
                    Suggested Window: {rec.suggestedWindow} · {rec.approvalNotice}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onSelectBook(rec.equipmentId)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800"
                  >
                    Reserve this instrument
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter Bar & Equipment Catalog */}
      <section className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg overflow-x-auto">
              {departments.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDeptFilter(dept)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                    deptFilter === dept
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {dept === 'All' ? 'All Departments' : dept}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto">
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Filter by room, model, or spec..."
                aria-label="Filter equipment catalog"
                className="w-full lg:w-64 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white min-h-[38px]"
              />
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 min-h-[38px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
              {RESOURCE_TYPES.map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setTypeFilter(rt)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                    typeFilter === rt
                      ? 'bg-white text-teal-800 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {rt === 'All' ? 'All Resource Types' : `${rt}s`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'all', label: 'All Status' },
                { id: 'available', label: 'Available Now' },
                { id: 'open_lab', label: 'Instant Open Lab' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAvailabilityFilter(opt.id as 'all' | 'available' | 'open_lab')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                    availabilityFilter === opt.id
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredEquipment.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">
              No laboratory equipment matches the selected filters.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-4 py-2 text-xs font-medium text-teal-800 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEquipment.map((item) => {
              const rType = inferResourceType(item);
              const nextOpen = nextOpenByEquipId.get(item.id) || 'Available';
              return (
                <article
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelectBook(item.id)}
                      className="w-full text-left block aspect-4/3 bg-slate-100 border-b border-slate-200 overflow-hidden focus:outline-none"
                    >
                      <EquipmentImage
                        src={item.imageUrl}
                        alt={item.name}
                        label={item.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <div className="p-5 space-y-2.5">
                      <p className="text-xs text-slate-500">
                        <span className="font-semibold text-teal-700">{rType}</span> · {item.department} · {item.location}
                      </p>
                      <h3 className="text-base font-semibold text-slate-900 leading-snug">
                        <button
                          type="button"
                          onClick={() => onSelectBook(item.id)}
                          className="text-left hover:text-teal-700 transition-colors"
                        >
                          {item.name}
                        </button>
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                      <p className="text-xs font-mono text-slate-500 pt-1">{item.specs}</p>
                      <p className="text-xs font-mono tabular-nums text-teal-700 font-medium">
                        {nextOpen}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {renderEquipmentStatus(item.status)}
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {item.requiresApproval ? 'Faculty Approval' : 'Instant Open Lab'} · Max {item.maxSlotHours}h
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectBook(item.id)}
                      disabled={item.status === 'maintenance'}
                      className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {item.status === 'maintenance' ? 'Offline' : 'Reserve'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* College Facilities & Academic Governance Directory */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Campus Laboratory Facilities & Borrowing Guidelines
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Standard operating procedures for cross-department student access at Westbridge Institute of Technology.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          <div className="space-y-2">
            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-teal-700" />
              Interdisciplinary Access
            </p>
            <p className="text-slate-600 leading-relaxed">
              Enrolled engineering and science students may reserve equipment outside their home department when approved under a course syllabus or thesis advisor.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              Safety & Cleanroom Badges
            </p>
            <p className="text-slate-600 leading-relaxed">
              High-voltage, CNC fabrication, and Cleanroom Wing C-301 instruments require active lab safety sign-off from the assigned faculty custodian before first run.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Clock3 className="w-4 h-4 text-teal-700" />
              Operating & Buffer Hours
            </p>
            <p className="text-slate-600 leading-relaxed">
              Campus labs operate Monday–Saturday, 8:00 AM to 9:00 PM. Thesis defense and funded grant deadlines receive priority during peak mid-term collisions.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-teal-700" />
              Department Custodians
            </p>
            <p className="text-slate-600 leading-relaxed">
              AI & HPC: Dr. E. Rostova · Robotics & CNC: Prof. M. Vance · Cleanroom: Dr. P. Nair · ECE & RF: Eng. D. Lin.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
