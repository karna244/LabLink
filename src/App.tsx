import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatLocalDateOffset } from './data/seedData';
import { useLabWorkspace } from './hooks/useLabWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RoleSwitcherBar } from './components/RoleSwitcherBar';
import {
  TopNav,
  type FacultyTab,
  type StudentTab,
} from './components/TopNav';
import { FacultySidebar } from './components/FacultySidebar';
import { DiscoverView } from './components/DiscoverView';

const ScheduleView = lazy(() =>
  import('./components/ScheduleView').then((m) => ({ default: m.ScheduleView }))
);
const ProjectsView = lazy(() =>
  import('./components/ProjectsView').then((m) => ({ default: m.ProjectsView }))
);
const ApprovalsView = lazy(() =>
  import('./components/ApprovalsView').then((m) => ({ default: m.ApprovalsView }))
);
const FacultyInventoryView = lazy(() =>
  import('./components/FacultyInventoryView').then((m) => ({
    default: m.FacultyInventoryView,
  }))
);
const StudentBookingsView = lazy(() =>
  import('./components/StudentBookingsView').then((m) => ({
    default: m.StudentBookingsView,
  }))
);
const UtilizationView = lazy(() =>
  import('./components/UtilizationView').then((m) => ({
    default: m.UtilizationView,
  }))
);
const BookingModal = lazy(() =>
  import('./components/BookingModal').then((m) => ({ default: m.BookingModal }))
);

function ViewFallback() {
  return (
    <div
      role="status"
      aria-label="Loading view"
      className="bg-white border border-slate-200 rounded-xl p-8 space-y-4 animate-pulse"
    >
      <div className="h-5 w-48 bg-slate-200 rounded" />
      <div className="h-4 w-80 bg-slate-100 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="h-24 bg-slate-100 rounded-lg" />
        <div className="h-24 bg-slate-100 rounded-lg" />
        <div className="h-24 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

function LabGridWorkspace() {
  const {
    persona,
    user,
    isFirebaseAdmin,
    userProfile,
    equipmentList,
    bookings,
    projectRequests,
    syncNotice,
    setSyncNotice,
    toastMessage,
    showToast,
    ssoPending,
    conflictClusters,
    pendingSlotCount,
    pendingProjectCount,
    isFacultyMode,
    currentActorUid,
    currentActorName,
    handleSwitchPersona,
    handleCreateBooking,
    handleCancelBooking,
    handleShiftOwnBooking,
    handleApplyConflictPlan,
    handleReviewBooking,
    handleCreateProjectRequest,
    handleReviewProject,
    handleUpdateEquipmentStatus,
    handleAddEquipment,
    handleInjectTestConflict,
    handleResetDemo,
    handleConnectGoogle,
    handleSignOut,
  } = useLabWorkspace();

  const [studentTab, setStudentTab] = useState<StudentTab>('catalog');
  const [facultyTab, setFacultyTab] = useState<FacultyTab>('approvals');

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [modalEquipId, setModalEquipId] = useState<string | undefined>(undefined);
  const [modalDate, setModalDate] = useState<string | undefined>(undefined);
  const [modalStartHour, setModalStartHour] = useState<number | undefined>(undefined);
  const [inventoryFormNonce, setInventoryFormNonce] = useState(0);

  const openBookingModal = (
    equipmentId?: string,
    date?: string,
    startHour?: number
  ) => {
    setModalEquipId(equipmentId);
    setModalDate(date || formatLocalDateOffset(0));
    setModalStartHour(startHour || 10);
    setBookingModalOpen(true);
  };

  const handleBooked = (result: { status: string; hasConflict: boolean }) => {
    if (result.hasConflict) {
      showToast('Reservation submitted and flagged for conflict resolution.');
    } else if (result.status === 'confirmed') {
      showToast('Lab slot confirmed on timetable.');
    } else {
      showToast('Reservation submitted for faculty custodian approval.');
    }
  };

  const handleFacultyRegisterInstrument = () => {
    setFacultyTab('inventory');
    setInventoryFormNonce((n) => n + 1);
  };

  const noticesBlock = (
    <>
      {user && !isFirebaseAdmin && persona === 'faculty' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-3">
          <span>
            Previewing Faculty Console while signed in as a student SSO account. Click “Exit SSO Sync” above to test full faculty approvals in Open Campus Mode.
          </span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="font-semibold text-indigo-800 hover:underline whitespace-nowrap shrink-0"
          >
            Exit SSO Sync
          </button>
        </div>
      )}
      {syncNotice && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 flex items-center justify-between gap-3"
        >
          <span>{syncNotice}</span>
          <button
            type="button"
            onClick={() => setSyncNotice('')}
            aria-label="Dismiss notice"
            className="text-amber-900 font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`border rounded-lg px-4 py-3 text-xs font-medium ${
            persona === 'faculty'
              ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
              : 'bg-teal-50 border-teal-200 text-teal-900'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </>
  );

  return (
    <div
      className={`min-h-screen flex flex-col overflow-x-hidden ${
        persona === 'faculty' ? 'bg-[#F8FAFC]' : 'bg-[#F2F5F7]'
      }`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg focus:text-xs focus:font-semibold"
      >
        Skip to main content
      </a>

      <RoleSwitcherBar
        persona={persona}
        user={user}
        userProfile={userProfile}
        isFirebaseAdmin={isFirebaseAdmin}
        ssoPending={ssoPending}
        onSwitchPersona={handleSwitchPersona}
        onResetDemo={handleResetDemo}
        onConnectGoogle={handleConnectGoogle}
        onSignOut={handleSignOut}
      />

      {persona === 'student' ? (
        <>
          <TopNav
            activeTab={studentTab}
            onTabChange={setStudentTab}
            onPrimaryAction={() => openBookingModal()}
          />

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 focus:outline-none"
          >
            {noticesBlock}
            <Suspense fallback={<ViewFallback />}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`student-${studentTab}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  {studentTab === 'catalog' && (
                    <DiscoverView
                      equipmentList={equipmentList}
                      bookings={bookings}
                      conflictCount={conflictClusters.length}
                      onSelectBook={(id) => openBookingModal(id)}
                      onGoToMyBookings={() => setStudentTab('my_bookings')}
                    />
                  )}

                  {studentTab === 'timetable' && (
                    <ScheduleView
                      equipmentList={equipmentList}
                      bookings={bookings}
                      currentActorUid={currentActorUid}
                      isFacultyMode={false}
                      accentColor="teal"
                      onCancelBooking={handleCancelBooking}
                      onOpenBooking={(eqId, date, hour) => openBookingModal(eqId, date, hour)}
                      onGoToApprovals={() => setStudentTab('my_bookings')}
                    />
                  )}

                  {studentTab === 'proposals' && (
                    <ProjectsView
                      equipmentList={equipmentList}
                      projectRequests={projectRequests}
                      defaultDepartment={
                        userProfile?.department || 'Electrical & Computer Engineering'
                      }
                      onCreateProjectRequest={handleCreateProjectRequest}
                    />
                  )}

                  {studentTab === 'my_bookings' && (
                    <StudentBookingsView
                      studentName={currentActorName}
                      studentUid={currentActorUid}
                      bookings={bookings}
                      equipmentList={equipmentList}
                      onCancelBooking={handleCancelBooking}
                      onOpenNewBooking={() => openBookingModal()}
                      onShiftOwnBooking={handleShiftOwnBooking}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </main>
        </>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
          <FacultySidebar
            activeTab={facultyTab}
            onTabChange={setFacultyTab}
            onPrimaryAction={handleFacultyRegisterInstrument}
            onSwitchToStudent={() => handleSwitchPersona('student')}
            facultyName={currentActorName}
            pendingCount={pendingSlotCount}
            conflictCount={conflictClusters.length}
            pendingProjectsCount={pendingProjectCount}
          />

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 focus:outline-none"
          >
            {noticesBlock}
            <Suspense fallback={<ViewFallback />}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`faculty-${facultyTab}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  {facultyTab === 'approvals' && (
                    <ApprovalsView
                      equipmentList={equipmentList}
                      bookings={bookings}
                      projectRequests={projectRequests}
                      onApplyConflictPlan={handleApplyConflictPlan}
                      onReviewBooking={handleReviewBooking}
                      onReviewProject={handleReviewProject}
                      onInjectTestConflict={handleInjectTestConflict}
                    />
                  )}

                  {facultyTab === 'inventory' && (
                    <FacultyInventoryView
                      equipmentList={equipmentList}
                      openFormNonce={inventoryFormNonce}
                      onUpdateEquipmentStatus={handleUpdateEquipmentStatus}
                      onAddEquipment={handleAddEquipment}
                    />
                  )}

                  {facultyTab === 'timetable' && (
                    <ScheduleView
                      equipmentList={equipmentList}
                      bookings={bookings}
                      currentActorUid={currentActorUid}
                      isFacultyMode={isFacultyMode}
                      accentColor="indigo"
                      onCancelBooking={handleCancelBooking}
                      onOpenBooking={(eqId, date, hour) => openBookingModal(eqId, date, hour)}
                      onGoToApprovals={() => setFacultyTab('approvals')}
                    />
                  )}

                  {facultyTab === 'analytics' && (
                    <UtilizationView
                      equipmentList={equipmentList}
                      bookings={bookings}
                      projectRequests={projectRequests}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </main>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-600">
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              Westbridge Institute of Technology · Office of Laboratory Operations
            </p>
            <p className="text-slate-500">
              School of Engineering & Applied Sciences · Academic Year 2026–2027 · North & South Engineering Quad
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-slate-500 font-mono tabular-nums">
            <span>Lab Hours: Mon–Sat 8:00 AM – 9:00 PM</span>
            <span aria-hidden="true">·</span>
            <span>Safety Desk: Ext. 4410</span>
          </div>
        </div>
      </footer>

      {bookingModalOpen && (
        <Suspense fallback={null}>
          <BookingModal
            isOpen={bookingModalOpen}
            onClose={() => setBookingModalOpen(false)}
            equipmentList={equipmentList}
            initialEquipmentId={modalEquipId}
            initialDate={modalDate}
            initialStartHour={modalStartHour}
            bookings={bookings}
            onCreateBooking={handleCreateBooking}
            onBooked={handleBooked}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LabGridWorkspace />
    </ErrorBoundary>
  );
}
