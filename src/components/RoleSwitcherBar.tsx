import { RotateCcw } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../types';
import type { DemoPersona } from '../hooks/useLabWorkspace';

interface RoleSwitcherBarProps {
  persona: DemoPersona;
  user: User | null;
  userProfile: UserProfile | null;
  isFirebaseAdmin: boolean;
  ssoPending: boolean;
  onSwitchPersona: (persona: DemoPersona) => void;
  onResetDemo: () => Promise<void>;
  onConnectGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function RoleSwitcherBar({
  persona,
  user,
  userProfile,
  isFirebaseAdmin,
  ssoPending,
  onSwitchPersona,
  onResetDemo,
  onConnectGoogle,
  onSignOut,
}: RoleSwitcherBarProps) {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-600 min-w-0">
          <span className="font-semibold text-slate-900">
            Westbridge Institute of Technology
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="truncate">
            {persona === 'student'
              ? 'Student Research Portal — Alex Rivera (M.S. Robotics)'
              : 'Faculty Governance Console — Dr. Elena Rostova (Lab Chair)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div
            role="group"
            aria-label="Switch interface view"
            className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200"
          >
            <button
              type="button"
              aria-pressed={persona === 'student'}
              onClick={() => onSwitchPersona('student')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                persona === 'student'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Student Interface
            </button>
            <button
              type="button"
              aria-pressed={persona === 'faculty'}
              onClick={() => onSwitchPersona('faculty')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                persona === 'faculty'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faculty Interface
            </button>
          </div>

          {!user ? (
            <>
              <button
                type="button"
                onClick={() => void onResetDemo()}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded px-1"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset Demo
              </button>

              <button
                type="button"
                disabled={ssoPending}
                onClick={() => void onConnectGoogle()}
                className={`font-medium transition-colors whitespace-nowrap disabled:opacity-50 min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded px-1 ${
                  persona === 'faculty'
                    ? 'text-indigo-700 hover:text-indigo-800'
                    : 'text-teal-700 hover:text-teal-800'
                }`}
              >
                {ssoPending ? 'Connecting SSO...' : 'Campus SSO Sync'}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-700">
                <span className="font-medium text-slate-900">
                  {userProfile?.displayName || user.displayName || user.email}
                </span>{' '}
                · {isFirebaseAdmin ? 'Faculty Admin (Cloud Sync)' : 'Student (Cloud Sync)'}
              </span>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded px-1"
              >
                Exit SSO Sync
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
