export type StudentTab = 'catalog' | 'timetable' | 'proposals' | 'my_bookings';
export type FacultyTab = 'approvals' | 'inventory' | 'timetable' | 'analytics';
export type NavTab = StudentTab | FacultyTab;

interface TopNavProps {
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  onPrimaryAction: () => void;
}

const STUDENT_NAV: { id: StudentTab; label: string }[] = [
  { id: 'catalog', label: 'Lab Catalog' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'proposals', label: 'Project Proposals' },
  { id: 'my_bookings', label: 'My Bookings' },
];

export function TopNav({
  activeTab,
  onTabChange,
  onPrimaryAction,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onTabChange('catalog')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
        >
          LabGrid
        </button>

        {/* Zone 2: Student single-line navigation links */}
        <nav aria-label="Student primary navigation" className="hidden md:flex items-center gap-7">
          {STUDENT_NAV.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(item.id)}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  isActive
                    ? 'border-teal-700 text-teal-800 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 min-h-[40px]"
          >
            Reserve Slot
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        aria-label="Student mobile navigation"
        className="flex md:hidden items-center gap-5 px-4 overflow-x-auto border-t border-slate-100 bg-slate-50/70"
      >
        {STUDENT_NAV.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(item.id)}
              className={`py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 min-h-[40px] ${
                isActive ? 'border-teal-700 text-teal-800 font-semibold' : 'border-transparent text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
