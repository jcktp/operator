'use client'

import { Loader2, Plus, Trash2, Users, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatCard, SectionHeader, HC_STATUSES, HC_STATUS_LABEL, HC_STATUS_COLOR, inputCls } from './capacity-shared'

interface HeadcountEntry {
  id: string; role: string; department: string; currentCount: number; targetCount: number
  openPositions: number; attritionRate: number; status: string; targetDate: string | null
  hiringManager: string | null; notes: string | null; projectId: string | null
}

interface HeadcountRegistrySectionProps {
  entries: HeadcountEntry[]
  loading: boolean
  showForm: boolean
  setShowForm: (v: boolean | ((prev: boolean) => boolean)) => void
  filterDept: string
  setFilterDept: (v: string) => void
  // Form state
  fRole: string; setFRole: (v: string) => void
  fDept: string; setFDept: (v: string) => void
  fCurrent: string; setFCurrent: (v: string) => void
  fTarget: string; setFTarget: (v: string) => void
  fOpen: string; setFOpen: (v: string) => void
  fAttrition: string; setFAttrition: (v: string) => void
  fStatus: string; setFStatus: (v: string) => void
  fTargetDate: string; setFTargetDate: (v: string) => void
  fHiringMgr: string; setFHiringMgr: (v: string) => void
  saving: boolean
  handleCreate: () => void
  updateStatus: (id: string, status: string) => void
  handleDelete: (id: string) => void
}

export default function HeadcountRegistrySection(props: HeadcountRegistrySectionProps) {
  const {
    entries, loading, showForm, setShowForm, filterDept, setFilterDept,
    fRole, setFRole, fDept, setFDept, fCurrent, setFCurrent, fTarget, setFTarget,
    fOpen, setFOpen, fAttrition, setFAttrition, fStatus, setFStatus,
    fTargetDate, setFTargetDate, fHiringMgr, setFHiringMgr,
    saving, handleCreate, updateStatus, handleDelete,
  } = props

  const departments = ['all', ...Array.from(new Set(entries.map(e => e.department))).sort()]
  const visible = filterDept === 'all' ? entries : entries.filter(e => e.department === filterDept)
  const totalCurrent = entries.reduce((s, e) => s + e.currentCount, 0)
  const totalTarget = entries.reduce((s, e) => s + e.targetCount, 0)
  const totalOpen = entries.reduce((s, e) => s + e.openPositions, 0)
  const recruiting = entries.filter(e => e.status === 'recruiting').length

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader icon={<UserPlus size={15} />} title="Headcount registry" />
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:bg-[var(--ink)] transition-colors">
          <Plus size={14} /> Add role
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Current headcount" value={totalCurrent.toString()} />
        <StatCard label="Target headcount" value={totalTarget.toString()} />
        <StatCard label="Open positions" value={totalOpen.toString()} accent={totalOpen > 0} />
        <StatCard label="Actively recruiting" value={recruiting.toString()} />
      </div>

      {departments.length > 2 && (
        <div className="flex gap-1.5 flex-wrap">
          {departments.map(d => (
            <button key={d} onClick={() => setFilterDept(d)}
              className={cn('h-6 px-2.5 rounded-[4px] text-[11px] font-medium border transition-colors capitalize',
                filterDept === d ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-transparent' : 'border-[var(--border)] text-[var(--text-muted)]')}>
              {d === 'all' ? 'All departments' : d}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-bright)]">Add Role</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Role *</label>
              <input value={fRole} onChange={e => setFRole(e.target.value)} placeholder="e.g. Senior Engineer" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Department *</label>
              <input value={fDept} onChange={e => setFDept(e.target.value)} placeholder="e.g. Engineering" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Current headcount</label>
              <input type="number" value={fCurrent} min={0} onChange={e => setFCurrent(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Target headcount</label>
              <input type="number" value={fTarget} min={0} onChange={e => setFTarget(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Open positions</label>
              <input type="number" value={fOpen} min={0} onChange={e => setFOpen(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Attrition rate % / yr</label>
              <input type="number" value={fAttrition} min={0} max={100} step={0.5} onChange={e => setFAttrition(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputCls}>
                {HC_STATUSES.map(s => <option key={s} value={s}>{HC_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Target fill date</label>
              <input type="date" value={fTargetDate} onChange={e => setFTargetDate(e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Hiring manager</label>
              <input value={fHiringMgr} onChange={e => setFHiringMgr(e.target.value)} placeholder="Who is running this hire?" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving || !fRole.trim() || !fDept.trim()}
              className="h-7 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />} Add
            </button>
            <button onClick={() => setShowForm(false)} className="h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">No roles tracked yet. Add your first role above.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(entry => {
            const gap_ = entry.targetCount - entry.currentCount
            return (
              <div key={entry.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
                <div className="flex items-start gap-3">
                  <Users size={15} className={cn('shrink-0 mt-0.5', HC_STATUS_COLOR[entry.status])} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[var(--text-bright)]">{entry.role}</p>
                      <span className="text-[11px] text-[var(--text-muted)]">{entry.department}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
                      <span>{entry.currentCount} current → {entry.targetCount} target</span>
                      {gap_ > 0 && <span className="text-[var(--amber)]">{gap_} gap</span>}
                      {entry.openPositions > 0 && <span className="text-blue-600">{entry.openPositions} open req{entry.openPositions !== 1 ? 's' : ''}</span>}
                      {entry.attritionRate > 0 && <span>{entry.attritionRate}% attrition/yr</span>}
                      {entry.hiringManager && <span>HM: {entry.hiringManager}</span>}
                      {entry.targetDate && <span>Target: {new Date(entry.targetDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <select value={entry.status} onChange={e => void updateStatus(entry.id, e.target.value)}
                    className={cn('text-xs font-medium h-7 px-2 rounded-[4px] border-0 bg-transparent focus:outline-none shrink-0', HC_STATUS_COLOR[entry.status])}>
                    {HC_STATUSES.map(s => <option key={s} value={s} className="bg-[var(--surface)] text-[var(--text-bright)]">{HC_STATUS_LABEL[s]}</option>)}
                  </select>
                  <button onClick={() => void handleDelete(entry.id)} className="text-[var(--border)] hover:text-[var(--red)] transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
