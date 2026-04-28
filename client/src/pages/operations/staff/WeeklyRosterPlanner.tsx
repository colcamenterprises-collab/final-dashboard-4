import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Users,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  Wand2,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

async function sapi(method: string, url: string, data?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

type ShiftRoster = {
  id: number;
  shiftDate: string;
  shiftName: string;
  templateId: number | null;
  shiftStartTime: string;
  shiftEndTime: string;
  maxStaff: number;
  isCustomShift: boolean;
  status: string;
  notes: string | null;
  createdBy: string;
  assignmentCount?: number;
  dailyCleaningTaskCount?: number;
  dailyCleaningCompletedCount?: number;
  deepCleaningAssignedCount?: number;
  cleaningIncomplete?: boolean;
};
type ShiftTemplate = {
  id: number;
  templateName: string;
  startTime: string;
  endTime: string;
  maxStaff: number;
  isPrepShift: boolean;
};
type StaffMember = {
  id: number;
  fullName: string;
  displayName: string | null;
  isActive: boolean;
  primaryRole: string;
};
type WorkArea = { id: number; name: string; isActive: boolean };
type ShiftAssignment = {
  id: number;
  shiftRosterId: number;
  staffMemberId: number;
  isPrepStarter: boolean;
  scheduledStartTime: string;
  scheduledEndTime: string;
  primaryStation: string | null;
  secondaryStation: string | null;
  isOffDay: boolean;
  shiftNotes: string | null;
};
type ShiftBreak = {
  id: number;
  shiftStaffAssignmentId: number;
  breakType: string;
  plannedStartTime: string;
  plannedEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  isManualOverride: boolean;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-200 text-slate-500',
};

const inputCls =
  'w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500';

function todayBkk() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}
function getWeekStart(base: Date) {
  const d = new Date(base);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-CA');
}
function fmtDisplay(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

const rosterSchema = z.object({
  shiftName: z.string().min(1, 'Roster name is required'),
  shiftStartTime: z.string().min(1, 'Start time required'),
  shiftEndTime: z.string().min(1, 'End time required'),
  maxStaff: z.coerce.number().int().min(1).max(50),
  isCustomShift: z.boolean(),
  templateId: z.number().nullable().optional(),
  notes: z.string().optional(),
});

const assignmentSchema = z.object({
  staffMemberId: z.coerce.number().min(1, 'Select a staff member'),
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  primaryStation: z.string().optional(),
  secondaryStation: z.string().optional(),
  isPrepStarter: z.boolean(),
  shiftNotes: z.string().optional(),
});

const autoGenerateSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetFairnessMode: z.enum(['equal_hours', 'equal_shifts']),
  mode: z.enum(['draft', 'publish']),
  overwriteExistingDrafts: z.boolean(),
  includeDailyCleaning: z.boolean(),
  includeDeepCleaning: z.boolean(),
  maxShiftsPerStaffPerWeek: z.coerce.number().nullable().optional(),
  maxHoursPerStaffPerWeek: z.coerce.number().nullable().optional(),
  preferredBusyDayStaffCount: z.coerce.number().nullable().optional(),
  allowBackToBackCloseOpen: z.boolean(),
});

const toNullablePositiveNumber = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  if (numberValue === 0) return null; // 0 = no limit
  return numberValue;
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </label>
  );
}

export default function WeeklyRosterPlanner() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() =>
    getWeekStart(new Date(todayBkk() + 'T12:00:00'))
  );
  const [selectedDate, setSelectedDate] = useState(todayBkk());
  const [expandedRosterId, setExpandedRosterId] = useState<number | null>(null);
  const [modal, setModal] = useState<'create-roster' | 'add-assignment' | null>(null);
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [autoGenerateResult, setAutoGenerateResult] = useState<any | null>(null);
  const [activeRosterId, setActiveRosterId] = useState<number | null>(null);
  const [breakModal, setBreakModal] = useState<{
    assignmentId: number;
    breaks: ShiftBreak[];
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editAssignment, setEditAssignment] = useState<ShiftAssignment | null>(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => fmtDate(addDays(weekStart, i)));

  const { data: rosters = [], isLoading } = useQuery<ShiftRoster[]>({
    queryKey: ['/api/operations/staff/rosters', weekDates[0], weekDates[6]],
    queryFn: () =>
      fetch(`/api/operations/staff/rosters?from=${weekDates[0]}&to=${weekDates[6]}`).then((r) =>
        r.json()
      ),
  });
  const { data: templates = [] } = useQuery<ShiftTemplate[]>({
    queryKey: ['/api/operations/staff/shift-templates'],
  });
  const { data: members = [] } = useQuery<StaffMember[]>({
    queryKey: ['/api/operations/staff/members'],
  });
  const { data: workAreas = [] } = useQuery<WorkArea[]>({
    queryKey: ['/api/operations/staff/work-areas'],
  });

  const { data: assignments = [], refetch: refetchAssignments } = useQuery<ShiftAssignment[]>({
    queryKey: ['/api/operations/staff/rosters', expandedRosterId, 'assignments'],
    queryFn: () =>
      fetch(`/api/operations/staff/rosters/${expandedRosterId}`)
        .then((r) => r.json())
        .then((d) => d.assignments ?? []),
    enabled: expandedRosterId !== null,
  });

  const rosterForm = useForm({
    resolver: zodResolver(rosterSchema),
    defaultValues: {
      shiftName: '',
      shiftStartTime: '17:00',
      shiftEndTime: '03:00',
      maxStaff: 5,
      isCustomShift: false,
      templateId: null as number | null,
      notes: '',
    },
  });
  const assignForm = useForm({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      staffMemberId: 0,
      scheduledStartTime: '17:00',
      scheduledEndTime: '03:00',
      primaryStation: '',
      secondaryStation: '',
      isPrepStarter: false,
      shiftNotes: '',
    },
  });
  const editAssignForm = useForm({
    resolver: zodResolver(assignmentSchema.partial()),
    defaultValues: {
      scheduledStartTime: '',
      scheduledEndTime: '',
      primaryStation: '',
      secondaryStation: '',
      isPrepStarter: false,
      shiftNotes: '',
    },
  });
  const autoGenerateForm = useForm({
    resolver: zodResolver(autoGenerateSchema),
    defaultValues: {
      weekStartDate: weekDates[0],
      weekEndDate: weekDates[6],
      targetFairnessMode: 'equal_hours' as const,
      mode: 'draft' as const,
      overwriteExistingDrafts: false,
      includeDailyCleaning: true,
      includeDeepCleaning: true,
      maxShiftsPerStaffPerWeek: null,
      maxHoursPerStaffPerWeek: null,
      preferredBusyDayStaffCount: null,
      allowBackToBackCloseOpen: true,
    },
  });

  const createRosterMut = useMutation({
    mutationFn: (d: z.infer<typeof rosterSchema>) =>
      sapi('POST', `/api/operations/staff/rosters`, {
        ...d,
        shiftDate: selectedDate,
        notes: d.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/operations/staff/rosters'] });
      setModal(null);
      rosterForm.reset();
      toast({ title: 'Roster created' });
    },
    onError: (err: Error) =>
      toast({ title: 'Create failed', description: err.message, variant: 'destructive' }),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      sapi('PATCH', `/api/operations/staff/rosters/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/operations/staff/rosters'] });
      toast({ title: 'Status updated' });
    },
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const deleteRosterMut = useMutation({
    mutationFn: (id: number) => sapi('DELETE', `/api/operations/staff/rosters/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/operations/staff/rosters'] });
      setDeleteConfirmId(null);
      if (expandedRosterId === deleteConfirmId) setExpandedRosterId(null);
      toast({ title: 'Roster deleted' });
    },
    onError: (err: Error) => {
      setDeleteConfirmId(null);
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const addAssignmentMut = useMutation({
    mutationFn: (d: z.infer<typeof assignmentSchema>) =>
      sapi('POST', `/api/operations/staff/rosters/${activeRosterId}/assignments`, d),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/operations/staff/rosters', expandedRosterId, 'assignments'],
      });
      setModal(null);
      assignForm.reset();
      toast({ title: 'Staff assigned' });
    },
    onError: () => toast({ title: 'Assign failed', variant: 'destructive' }),
  });

  const removeAssignmentMut = useMutation({
    mutationFn: (id: number) => sapi('DELETE', `/api/operations/staff/assignments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/operations/staff/rosters', expandedRosterId, 'assignments'],
      });
      qc.invalidateQueries({ queryKey: ['/api/operations/staff/rosters'] });
      toast({ title: 'Removed' });
    },
    onError: () => toast({ title: 'Remove failed', variant: 'destructive' }),
  });

  const editAssignMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      sapi('PATCH', `/api/operations/staff/assignments/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/operations/staff/rosters', expandedRosterId, 'assignments'],
      });
      qc.invalidateQueries({ queryKey: ['/api/operations/staff/rosters'] });
      setEditAssignment(null);
      toast({ title: 'Assignment updated' });
    },
    onError: (err: Error) =>
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const generateBreaksMut = useMutation({
    mutationFn: (rosterId: number) =>
      sapi('POST', `/api/operations/staff/rosters/${rosterId}/breaks/auto-generate`, {}),
    onSuccess: () => {
      toast({ title: 'Breaks generated' });
      refetchAssignments();
    },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });

  const updateBreakMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      sapi('PATCH', `/api/operations/staff/breaks/${id}`, data),
    onSuccess: () => {
      toast({ title: 'Break updated' });
    },
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  });

  const autoGenerateMut = useMutation({
    mutationFn: (d: z.infer<typeof autoGenerateSchema>) =>
      sapi('POST', `/api/operations/staff/rosters/auto-generate-week`, {
        businessLocationId: 1,
        weekStartDate: d.weekStartDate,
        weekEndDate: d.weekEndDate,
        mode: d.mode,
        overwriteExistingDrafts: d.overwriteExistingDrafts,
        targetFairnessMode: d.targetFairnessMode,
        includeDailyCleaning: d.includeDailyCleaning,
        includeDeepCleaning: d.includeDeepCleaning,
        ownerRules: {
          maxShiftsPerStaffPerWeek: toNullablePositiveNumber(d.maxShiftsPerStaffPerWeek),
          minHoursPerStaffPerWeek: null,
          maxHoursPerStaffPerWeek: toNullablePositiveNumber(d.maxHoursPerStaffPerWeek),
          preferredBusyDayStaffCount: toNullablePositiveNumber(d.preferredBusyDayStaffCount),
          allowBackToBackCloseOpen: d.allowBackToBackCloseOpen,
        },
      }),
    onSuccess: (result) => {
      setAutoGenerateResult(result);
      qc.invalidateQueries({ queryKey: ['/api/operations/staff/rosters'] });
      toast({ title: 'Weekly roster generated' });
    },
    onError: (err: Error) =>
      toast({ title: 'Auto-generate failed', description: err.message, variant: 'destructive' }),
  });

  function applyTemplate(tpl: ShiftTemplate) {
    rosterForm.setValue('shiftName', tpl.templateName);
    rosterForm.setValue('shiftStartTime', tpl.startTime);
    rosterForm.setValue('shiftEndTime', tpl.endTime);
    rosterForm.setValue('maxStaff', tpl.maxStaff);
    rosterForm.setValue('templateId', tpl.id);
    rosterForm.setValue('isCustomShift', false);
  }

  const dayRosters = rosters.filter((r) => r.shiftDate === selectedDate);
  const today = todayBkk();

  async function downloadPdf(url: string, fileName: string) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`${response.status}: Failed to download ${fileName}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleTeamRosterExport() {
    try {
      const weekStartDate = weekDates[0];
      await downloadPdf(
        `/api/operations/staff/rosters/export/team?weekStart=${weekStartDate}`,
        `team-roster-${weekStartDate}.pdf`
      );
      toast({ title: 'Team roster PDF downloaded' });
    } catch (error) {
      toast({
        title: 'Team export failed',
        description: error instanceof Error ? error.message : 'Download failed',
        variant: 'destructive',
      });
    }
  }

  async function handleIndividualRosterExport() {
    try {
      const weekStartDate = weekDates[0];
      const rosterIds = rosters.map((r) => r.id);
      const staffIds = new Set<number>();

      for (const rosterId of rosterIds) {
        const details = await fetch(`/api/operations/staff/rosters/${rosterId}`, {
          credentials: 'include',
        }).then((r) => r.json());
        const rosterAssignments = (details.assignments ?? []) as ShiftAssignment[];
        rosterAssignments.forEach((assignment) => staffIds.add(assignment.staffMemberId));
      }

      if (staffIds.size === 0) {
        toast({ title: 'No assigned staff found for this week' });
        return;
      }

      for (const staffId of staffIds) {
        await downloadPdf(
          `/api/operations/staff/rosters/export/staff/${staffId}?weekStart=${weekStartDate}`,
          `staff-roster-${staffId}-${weekStartDate}.pdf`
        );
      }

      toast({ title: `Downloaded ${staffIds.size} individual roster PDFs` });
    } catch (error) {
      toast({
        title: 'Individual export failed',
        description: error instanceof Error ? error.message : 'Download failed',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Weekly Roster Planner</h1>
          <p className="text-xs text-slate-500 mt-0.5">Create, assign and publish shift rosters.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTeamRosterExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" /> Export Team PDF
          </button>
          <button
            onClick={handleIndividualRosterExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" /> Export Individual PDFs
          </button>
          <button
            onClick={() => {
              autoGenerateForm.reset({
                ...autoGenerateForm.getValues(),
                weekStartDate: weekDates[0],
                weekEndDate: weekDates[6],
              });
              setShowAutoGenerateModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-50"
          >
            <Wand2 className="w-3.5 h-3.5" /> Auto Generate Week
          </button>
          <button
            onClick={() => {
              setModal('create-roster');
              rosterForm.reset({
                shiftName: '',
                shiftStartTime: '17:00',
                shiftEndTime: '03:00',
                maxStaff: 5,
                isCustomShift: true,
                templateId: null,
                notes: '',
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700"
          >
            <Plus className="w-3.5 h-3.5" /> New Roster
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-700">
            {fmtDisplay(weekDates[0])} – {fmtDisplay(weekDates[6])}
          </span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((d, i) => {
            const dayRosterCount = rosters.filter((r) => r.shiftDate === d).length;
            const isToday = d === today;
            const isSelected = d === selectedDate;
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors text-xs ${isSelected ? 'bg-emerald-600 text-white' : isToday ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <span className="font-medium">{DAY_LABELS[i]}</span>
                <span className={`text-xs ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {new Date(d + 'T12:00:00').getDate()}
                </span>
                {dayRosterCount > 0 && (
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-200' : 'bg-emerald-400'}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Rosters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <span className="text-xs text-slate-400">
            {dayRosters.length} roster{dayRosters.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <div className="text-xs text-slate-400">Loading...</div>
        ) : dayRosters.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center">
            <p className="text-sm text-slate-400">No rosters for this day.</p>
            <button
              onClick={() => {
                setModal('create-roster');
              }}
              className="mt-2 text-xs text-emerald-600 hover:underline"
            >
              Create a roster
            </button>
          </div>
        ) : (
          dayRosters.map((roster) => {
            const isExpanded = expandedRosterId === roster.id;
            const rosterAssignments = isExpanded ? assignments : [];
            return (
              <div
                key={roster.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">
                        {roster.shiftName}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[roster.status] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {roster.status}
                      </span>
                      {roster.isCustomShift && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-violet-100 text-violet-700">
                          Custom
                        </span>
                      )}
                      {typeof roster.assignmentCount === 'number' && (
                        <span
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${roster.assignmentCount === 0 ? 'bg-slate-100 text-slate-400' : roster.assignmentCount >= roster.maxStaff ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}
                        >
                          <Users className="w-3 h-3" />
                          {roster.assignmentCount}/{roster.maxStaff}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${roster.cleaningIncomplete ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        Cleaning {roster.dailyCleaningCompletedCount ?? 0}/
                        {roster.dailyCleaningTaskCount ?? 0}
                      </span>
                      {(roster.deepCleaningAssignedCount ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">
                          Deep {roster.deepCleaningAssignedCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {roster.shiftStartTime} – {roster.shiftEndTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {roster.status === 'draft' && (
                      <button
                        onClick={() =>
                          updateStatusMut.mutate({ id: roster.id, status: 'published' })
                        }
                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      >
                        Publish
                      </button>
                    )}
                    {roster.status === 'published' && (
                      <button
                        onClick={() => updateStatusMut.mutate({ id: roster.id, status: 'closed' })}
                        className="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700"
                      >
                        Close
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirmId(roster.id)}
                      className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setExpandedRosterId(isExpanded ? null : roster.id)}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-600">
                        Assignments ({rosterAssignments.length})
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => generateBreaksMut.mutate(roster.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-white text-slate-600"
                        >
                          <Zap className="w-3 h-3" /> Auto-breaks
                        </button>
                        <button
                          onClick={() => {
                            setActiveRosterId(roster.id);
                            setModal('add-assignment');
                            assignForm.reset({
                              staffMemberId: 0,
                              scheduledStartTime: roster.shiftStartTime,
                              scheduledEndTime: roster.shiftEndTime,
                              primaryStation: '',
                              secondaryStation: '',
                              isPrepStarter: false,
                              shiftNotes: '',
                            });
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          <Plus className="w-3 h-3" /> Assign Staff
                        </button>
                      </div>
                    </div>
                    {rosterAssignments.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No staff assigned yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {rosterAssignments.map((a) => {
                          const member = members.find((m) => m.id === a.staffMemberId);
                          return (
                            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                                {member?.fullName.charAt(0) ?? '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800">
                                  {member?.fullName ?? `Staff #${a.staffMemberId}`}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {a.scheduledStartTime} – {a.scheduledEndTime}
                                  {a.primaryStation && (
                                    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
                                      {a.primaryStation}
                                    </span>
                                  )}
                                  {a.secondaryStation && (
                                    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 text-xs">
                                      {a.secondaryStation}
                                    </span>
                                  )}
                                  {a.isPrepStarter && (
                                    <span className="ml-1 text-amber-600">· Prep</span>
                                  )}
                                </p>
                                {a.shiftNotes && (
                                  <p className="text-xs text-slate-400 italic mt-0.5 truncate">
                                    {a.shiftNotes}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditAssignment(a);
                                    editAssignForm.reset({
                                      scheduledStartTime: a.scheduledStartTime,
                                      scheduledEndTime: a.scheduledEndTime,
                                      primaryStation: a.primaryStation ?? '',
                                      secondaryStation: a.secondaryStation ?? '',
                                      isPrepStarter: a.isPrepStarter,
                                      shiftNotes: a.shiftNotes ?? '',
                                    });
                                  }}
                                  className="p-1 rounded hover:bg-blue-50 text-blue-400"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => removeAssignmentMut.mutate(a.id)}
                                  className="p-1 rounded hover:bg-red-50 text-red-400"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Roster Modal */}
      {modal === 'create-roster' && (
        <Modal title={`New Roster — ${fmtDisplay(selectedDate)}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {templates.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">
                  Quick-fill from template
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {templates
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className="px-2 py-1 text-xs border border-slate-300 rounded hover:border-emerald-500 hover:bg-emerald-50 text-slate-700"
                      >
                        {t.templateName}
                      </button>
                    ))}
                </div>
              </div>
            )}
            <form
              onSubmit={rosterForm.handleSubmit((d) => createRosterMut.mutate(d))}
              className="space-y-3"
            >
              <Field label="Roster Name *" error={rosterForm.formState.errors.shiftName?.message}>
                <input
                  {...rosterForm.register('shiftName')}
                  className={inputCls}
                  placeholder="e.g. Evening Main Shift"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Time *">
                  <input
                    type="time"
                    {...rosterForm.register('shiftStartTime')}
                    className={inputCls}
                  />
                </Field>
                <Field label="End Time *">
                  <input
                    type="time"
                    {...rosterForm.register('shiftEndTime')}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Max Staff">
                <input type="number" {...rosterForm.register('maxStaff')} className={inputCls} />
              </Field>
              <Field label="Notes (optional)">
                <input
                  {...rosterForm.register('notes')}
                  className={inputCls}
                  placeholder="Internal notes..."
                />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRosterMut.isPending}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {createRosterMut.isPending ? 'Creating...' : 'Create Roster'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Add Assignment Modal */}
      {modal === 'add-assignment' && (
        <Modal title="Assign Staff Member" onClose={() => setModal(null)}>
          <form
            onSubmit={assignForm.handleSubmit((d) => addAssignmentMut.mutate(d))}
            className="space-y-4"
          >
            <Field
              label="Staff Member *"
              error={assignForm.formState.errors.staffMemberId?.message}
            >
              <select {...assignForm.register('staffMemberId')} className={inputCls}>
                <option value={0}>Select staff member...</option>
                {members
                  .filter((m) => m.isActive)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.primaryRole})
                    </option>
                  ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time">
                <input
                  type="time"
                  {...assignForm.register('scheduledStartTime')}
                  className={inputCls}
                />
              </Field>
              <Field label="End Time">
                <input
                  type="time"
                  {...assignForm.register('scheduledEndTime')}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary Station">
                <select {...assignForm.register('primaryStation')} className={inputCls}>
                  <option value="">None</option>
                  {workAreas
                    .filter((w) => w.isActive)
                    .map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Secondary Station">
                <select {...assignForm.register('secondaryStation')} className={inputCls}>
                  <option value="">None</option>
                  {workAreas
                    .filter((w) => w.isActive)
                    .map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...assignForm.register('isPrepStarter')}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-xs text-slate-600">
                Prep start (arrives early for prep shift)
              </span>
            </div>
            <Field label="Notes">
              <input
                {...assignForm.register('shiftNotes')}
                className={inputCls}
                placeholder="Optional"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addAssignmentMut.isPending}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                {addAssignmentMut.isPending ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Assignment Modal */}
      {editAssignment !== null &&
        (() => {
          const member = members.find((m) => m.id === editAssignment.staffMemberId);
          return (
            <Modal
              title={`Edit — ${member?.fullName ?? 'Assignment'}`}
              onClose={() => setEditAssignment(null)}
            >
              <form
                onSubmit={editAssignForm.handleSubmit((d) =>
                  editAssignMut.mutate({ id: editAssignment.id, data: d })
                )}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Time">
                    <input
                      type="time"
                      {...editAssignForm.register('scheduledStartTime')}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="End Time">
                    <input
                      type="time"
                      {...editAssignForm.register('scheduledEndTime')}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Primary Station">
                    <select {...editAssignForm.register('primaryStation')} className={inputCls}>
                      <option value="">None</option>
                      {workAreas
                        .filter((w) => w.isActive)
                        .map((w) => (
                          <option key={w.id} value={w.name}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Secondary Station">
                    <select {...editAssignForm.register('secondaryStation')} className={inputCls}>
                      <option value="">None</option>
                      {workAreas
                        .filter((w) => w.isActive)
                        .map((w) => (
                          <option key={w.id} value={w.name}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...editAssignForm.register('isPrepStarter')}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-xs text-slate-600">
                    Prep start (arrives early for prep shift)
                  </span>
                </div>
                <Field label="Notes">
                  <input
                    {...editAssignForm.register('shiftNotes')}
                    className={inputCls}
                    placeholder="Optional"
                  />
                </Field>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditAssignment(null)}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editAssignMut.isPending}
                    className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {editAssignMut.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </Modal>
          );
        })()}

      {showAutoGenerateModal && (
        <Modal title="Auto Generate Weekly Roster" onClose={() => setShowAutoGenerateModal(false)}>
          <form
            onSubmit={autoGenerateForm.handleSubmit((d) => autoGenerateMut.mutate(d))}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Week Start Date">
                <input
                  type="date"
                  {...autoGenerateForm.register('weekStartDate')}
                  className={inputCls}
                />
              </Field>
              <Field label="Week End Date">
                <input
                  type="date"
                  {...autoGenerateForm.register('weekEndDate')}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fairness Mode">
                <select {...autoGenerateForm.register('targetFairnessMode')} className={inputCls}>
                  <option value="equal_hours">Equal Hours</option>
                  <option value="equal_shifts">Equal Shifts</option>
                </select>
              </Field>
              <Field label="Generate As">
                <select {...autoGenerateForm.register('mode')} className={inputCls}>
                  <option value="draft">Draft</option>
                  <option value="publish">Published</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max shifts per staff">
                <input
                  type="number"
                  {...autoGenerateForm.register('maxShiftsPerStaffPerWeek', {
                    setValueAs: (v) => (v === '' ? null : Number(v)),
                  })}
                  className={inputCls}
                />
              </Field>
              <Field label="Max hours per staff (optional)">
                <input
                  type="number"
                  min={0}
                  {...autoGenerateForm.register('maxHoursPerStaffPerWeek', {
                    setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                  })}
                  className={inputCls}
                />
                <p className="mt-0.5 text-[11px] text-slate-500">0 = no limit</p>
              </Field>
            </div>
            <Field label="Preferred busy day staff count">
              <input
                type="number"
                {...autoGenerateForm.register('preferredBusyDayStaffCount', {
                  setValueAs: (v) => (v === '' ? null : Number(v)),
                })}
                className={inputCls}
              />
            </Field>
            <div className="space-y-1 text-xs text-slate-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...autoGenerateForm.register('overwriteExistingDrafts')}
                  className="w-4 h-4 accent-emerald-600"
                />{' '}
                Overwrite existing draft rosters
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...autoGenerateForm.register('includeDailyCleaning')}
                  className="w-4 h-4 accent-emerald-600"
                />{' '}
                Include daily cleaning allocation
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...autoGenerateForm.register('includeDeepCleaning')}
                  className="w-4 h-4 accent-emerald-600"
                />{' '}
                Include deep cleaning allocation
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...autoGenerateForm.register('allowBackToBackCloseOpen')}
                  className="w-4 h-4 accent-emerald-600"
                />{' '}
                Allow close-to-open scheduling
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAutoGenerateModal(false)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={autoGenerateMut.isPending}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                {autoGenerateMut.isPending ? 'Generating...' : 'Generate Week'}
              </button>
            </div>
          </form>
          {autoGenerateResult && (
            <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Generation Summary</p>
              <p className="text-xs text-slate-600">
                Rosters: {autoGenerateResult.rostersCreated} · Assignments:{' '}
                {autoGenerateResult.assignmentsCreated} · Daily Cleaning:{' '}
                {autoGenerateResult.dailyCleaningTasksGenerated} · Deep Cleaning:{' '}
                {autoGenerateResult.deepCleaningTasksAllocated}
              </p>
              {Array.isArray(autoGenerateResult.fairness) &&
                autoGenerateResult.fairness.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded">
                    {autoGenerateResult.fairness.map((f: any) => (
                      <div
                        key={f.staffMemberId}
                        className="px-2 py-1 text-xs border-b border-slate-100 last:border-b-0"
                      >
                        {f.staffName}: {f.totalHours}h / {f.shiftCount} shifts /{' '}
                        {f.assignedCleaningMinutes} cleaning min
                      </div>
                    ))}
                  </div>
                )}
              {Array.isArray(autoGenerateResult.warnings) &&
                autoGenerateResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    {autoGenerateResult.warnings.map((w: string, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {w}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <Modal title="Delete roster?" onClose={() => setDeleteConfirmId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This will remove the shift and its related assignments, breaks, cleaning tasks, and
              attendance records. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteRosterMut.isPending}
                onClick={() => deleteRosterMut.mutate(deleteConfirmId)}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteRosterMut.isPending ? 'Deleting...' : 'Delete Roster'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
