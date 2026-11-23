import { ArrowLeftRight, CalendarDays, CheckSquare, ClipboardList, BarChart3, Plus, ShieldCheck } from 'lucide-react';
import type { FacultyTab } from './TopNav';

interface FacultySidebarProps {
  activeTab: FacultyTab;
  onTabChange: (tab: FacultyTab) => void;
  onPrimaryAction: () => void;
  onSwitchToStudent?: () => void;
  facultyName: string;
  pendingCount: number;
  conflictCount: number;
  pendingProjectsCount: number;
}

const FACULTY_NAV: {
  id: FacultyTab;
  label: string;
  icon: typeof CheckSquare;
}[] = [
  { id: 'approvals', label: 'Approval Queue', icon: CheckSquare },
  { id: 'inventory', label: 'Lab Inventory', icon: ClipboardList },
  { id: 'timetable', label: 'Master Timetable', icon: CalendarDays },
  { id: 'analytics', label: 'Utilization Analytics', icon: BarChart3 },
];

export function FacultySidebar({
  activeTab,
  onTabChange,
  onPrimaryAction,
  onSwitchToStudent,
  facultyName,
  pendingCount,
  conflictCount,
  pendingProjectsCount,
}: FacultySidebarProps) {
  return (
    <>
      {/* Mobile & Tablet Compact Header + Nav Strip */}
      <div className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onTabChange('approvals')}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span>LabGrid</span>
            <span className="text-xs font-medium text-indigo-700">Faculty Console</span>
          </button>

          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-3 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-600 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 min-h-[38px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Resource
          </button>
        </div>

        <nav
          aria-label="Faculty mobile navigation"
          className="flex items-center gap-4 px-4 overflow-x-auto border-t border-slate-100 bg-slate-50/70"
        >
          {FACULTY_NAV.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(item.id)}
                className={`py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 inline-flex items-center gap-1.5 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  isActive
                    ? 'border-indigo-700 text-indigo-800 font-semibold'
                    : 'border-transparent text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Desktop Dedicated Governance Sidebar */}
      <aside
        aria-label="Faculty governance sidebar"
        className="hidden lg:flex lg:flex-col lg:w-64 xl:w-72 shrink-0 bg-white border-r border-slate-200"
      >
        <div className="p-6 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onTabChange('approvals')}
              className="text-lg font-bold tracking-tight text-slate-900 text-left"
            >
              LabGrid Console
            </button>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Faculty Governance View
            </p>
            <p className="text-xs text-slate-600 truncate">{facultyName}</p>
            <p className="text-[11px] text-slate-500">Office of Laboratory Operations</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {FACULTY_NAV.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            const queueCount =
              item.id === 'approvals'
                ? pendingCount + conflictCount + pendingProjectsCount
                : null;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between gap-2 transition-colors min-h-[42px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {queueCount !== null && queueCount > 0 && (
                  <span className="text-xs font-mono tabular-nums font-semibold text-indigo-700 shrink-0">
                    {queueCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
            <p className="font-semibold text-slate-800">Queue Summary</p>
            <div className="flex items-center justify-between text-slate-600">
              <span>Slot Approvals</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {pendingCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Conflicts</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  conflictCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {conflictCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Project Proposals</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {pendingProjectsCount}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onPrimaryAction}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 min-h-[42px]"
          >
            <Plus className="w-4 h-4" />
            Register Instrument
          </button>

          {onSwitchToStudent && (
            <button
              type="button"
              onClick={onSwitchToStudent}
              className="w-full px-3.5 py-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex items-center justify-center gap-1.5 min-h-[38px]"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Switch to Student Interface
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
