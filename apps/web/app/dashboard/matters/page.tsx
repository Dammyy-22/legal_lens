'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Circle,
  CircleCheck,
  LoaderCircle,
  Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface MatterTask {
  id: string
  matter_id: string
  title: string
  due_date: string | null
  completed_at: string | null
}

interface LegalMatter {
  id: string
  title: string
  practice_area: string
  jurisdiction: string
  status: 'open' | 'closed'
  created_at: string
  tasks: MatterTask[]
}

const PRACTICE_AREAS = [
  'General',
  'Employment',
  'Housing and tenancy',
  'Family',
  'Business and contracts',
  'Consumer',
  'Property',
  'Criminal',
  'Other',
]

export default function MattersPage() {
  const [matters, setMatters] = useState<LegalMatter[]>([])
  const [title, setTitle] = useState('')
  const [practiceArea, setPracticeArea] = useState(PRACTICE_AREAS[0])
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({})
  const [taskDates, setTaskDates] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingMatter, setSavingMatter] = useState(false)
  const [savingTask, setSavingTask] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void loadMatters()
  }, [])

  async function loadMatters() {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: matterRows, error: matterError } = await supabase
        .from('legal_matters')
        .select('id, title, practice_area, jurisdiction, status, created_at')
        .order('created_at', { ascending: false })
      if (matterError) throw matterError

      const rows = matterRows ?? []
      if (rows.length === 0) {
        setMatters([])
        return
      }

      const { data: taskRows, error: taskError } = await supabase
        .from('legal_matter_tasks')
        .select('id, matter_id, title, due_date, completed_at')
        .in('matter_id', rows.map((matter) => matter.id))
        .order('due_date', { ascending: true })
      if (taskError) throw taskError

      setMatters(rows.map((matter) => ({
        ...matter,
        status: matter.status as LegalMatter['status'],
        tasks: (taskRows ?? []).filter((task) => task.matter_id === matter.id),
      })))
    } catch (loadError) {
      console.error('Could not load legal matters:', loadError)
      setError('Unable to load your matters. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateMatter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Enter a short matter name.')
      return
    }

    setSavingMatter(true)
    setError('')
    setNotice('')
    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Your session has expired. Sign in and try again.')

      const { error: insertError } = await supabase.from('legal_matters').insert({
        owner_id: user.id,
        title: trimmedTitle,
        practice_area: practiceArea,
        jurisdiction: 'Nigeria',
      })
      if (insertError) throw insertError
      setTitle('')
      setNotice('Matter created.')
      await loadMatters()
    } catch (createError) {
      console.error('Could not create a legal matter:', createError)
      setError(createError instanceof Error ? createError.message : 'Unable to create this matter.')
    } finally {
      setSavingMatter(false)
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>, matterId: string) {
    event.preventDefault()
    const taskTitle = taskTitles[matterId]?.trim()
    if (!taskTitle) {
      setError('Enter a task name.')
      return
    }

    setSavingTask(matterId)
    setError('')
    setNotice('')
    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Your session has expired. Sign in and try again.')

      const { error: insertError } = await supabase.from('legal_matter_tasks').insert({
        owner_id: user.id,
        matter_id: matterId,
        title: taskTitle,
        due_date: taskDates[matterId] || null,
      })
      if (insertError) throw insertError
      setTaskTitles((current) => ({ ...current, [matterId]: '' }))
      setTaskDates((current) => ({ ...current, [matterId]: '' }))
      setNotice('Task added.')
      await loadMatters()
    } catch (createError) {
      console.error('Could not create a matter task:', createError)
      setError(createError instanceof Error ? createError.message : 'Unable to add this task.')
    } finally {
      setSavingTask(null)
    }
  }

  async function toggleTask(task: MatterTask) {
    setUpdatingId(task.id)
    setError('')
    setNotice('')
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('legal_matter_tasks')
        .update({ completed_at: task.completed_at ? null : new Date().toISOString() })
        .eq('id', task.id)
      if (updateError) throw updateError
      setNotice(task.completed_at ? 'Task reopened.' : 'Task marked complete.')
      await loadMatters()
    } catch (updateError) {
      console.error('Could not update a matter task:', updateError)
      setError('Unable to update this task. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function toggleMatter(matter: LegalMatter) {
    setUpdatingId(matter.id)
    setError('')
    setNotice('')
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('legal_matters')
        .update({ status: matter.status === 'open' ? 'closed' : 'open', updated_at: new Date().toISOString() })
        .eq('id', matter.id)
      if (updateError) throw updateError
      setNotice(matter.status === 'open' ? 'Matter closed.' : 'Matter reopened.')
      await loadMatters()
    } catch (updateError) {
      console.error('Could not update a legal matter:', updateError)
      setError('Unable to update this matter. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="workspace-enter mx-auto max-w-5xl px-5 py-8 sm:px-8 md:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass-600">Private workspace</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink">Matters &amp; tasks</h1>
      <p className="mb-7 mt-3 max-w-3xl leading-7 text-ink-400">
        Organize matters and follow-up tasks.
      </p>

      <aside className="mb-7 rounded-xl border border-brass/25 bg-white p-4 text-sm leading-6 text-ink-400">
        Private to your account. Store only what you need. Dates are not verified legal deadlines;
        confirm court or statutory deadlines with a lawyer.
      </aside>

      {error && <p role="alert" className="mb-5 rounded-lg border border-seal/25 bg-seal/5 p-4 text-sm text-seal">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-lg border border-ink-100 bg-white p-3 text-sm text-ink-400">{notice}</p>}

      <form onSubmit={handleCreateMatter} className="mb-8 rounded-xl border border-ink-100 bg-white p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium text-ink">Create a matter</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
          <label className="text-sm font-medium text-ink">
            Short name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              required
              placeholder="For example: Flat repairs"
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 px-3 text-sm font-normal text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            />
          </label>
          <label className="text-sm font-medium text-ink">
            Area
            <select
              value={practiceArea}
              onChange={(event) => setPracticeArea(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-lg border border-ink-100 bg-white px-3 text-sm font-normal text-ink focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
            >
              {PRACTICE_AREAS.map((area) => <option key={area}>{area}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={savingMatter}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-600 disabled:opacity-50"
          >
            {savingMatter ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
            Create matter
          </button>
        </div>
      </form>

      <section aria-labelledby="matters-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="matters-heading" className="font-display text-2xl font-medium text-ink">Your matters</h2>
          {matters.length > 0 && <span className="text-xs text-ink-400">{matters.length} total</span>}
        </div>
        {loading && <p role="status" className="py-6 text-sm text-ink-400">Loading your private matters…</p>}
        {!loading && matters.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-ink-100 bg-white p-8 text-center">
            <BriefcaseBusiness size={24} className="mx-auto text-brass-600" />
            <p className="mt-3 font-medium text-ink">No matters yet</p>
            <p className="mt-1 text-sm text-ink-400">Create a matter above to organize your own follow-up tasks.</p>
          </div>
        )}
        <ul className="space-y-4">
          {matters.map((matter) => {
            const openTasks = matter.tasks.filter((task) => !task.completed_at).length
            return (
              <li key={matter.id} className="rounded-xl border border-ink-100 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-medium text-ink">{matter.title}</h3>
                      <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-wide ${
                        matter.status === 'open' ? 'bg-ink/5 text-ink-400' : 'bg-paper text-brass-600'
                      }`}>{matter.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-400">{matter.practice_area} · {matter.jurisdiction} · {openTasks} open {openTasks === 1 ? 'task' : 'tasks'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleMatter(matter)}
                    disabled={updatingId === matter.id}
                    className="min-h-9 rounded-lg border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-400 transition-colors hover:border-brass/40 hover:text-ink disabled:opacity-50"
                  >
                    {updatingId === matter.id ? 'Saving…' : matter.status === 'open' ? 'Close matter' : 'Reopen matter'}
                  </button>
                </div>

                {matter.tasks.length > 0 && (
                  <ul className="mt-5 divide-y divide-ink-100 border-y border-ink-100">
                    {matter.tasks.map((task) => {
                      const overdue = Boolean(task.due_date && task.due_date < localDateString() && !task.completed_at)
                      return (
                        <li key={task.id} className="flex items-center gap-3 py-3">
                          <button
                            type="button"
                            onClick={() => void toggleTask(task)}
                            disabled={updatingId === task.id}
                            aria-label={task.completed_at ? `Reopen ${task.title}` : `Mark ${task.title} complete`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brass-600 hover:bg-paper disabled:opacity-50"
                          >
                            {updatingId === task.id ? <LoaderCircle size={16} className="animate-spin" /> : task.completed_at ? <CircleCheck size={18} /> : <Circle size={18} />}
                          </button>
                          <span className={`min-w-0 flex-1 text-sm ${task.completed_at ? 'text-ink-400 line-through' : 'text-ink'}`}>{task.title}</span>
                          {task.due_date && (
                            <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${overdue ? 'font-medium text-seal' : 'text-ink-400'}`}>
                              <CalendarDays size={14} />
                              {overdue ? 'Past date · ' : ''}{formatDate(task.due_date)}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {matter.status === 'open' && (
                  <form onSubmit={(event) => void handleCreateTask(event, matter.id)} className="mt-4 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
                    <label className="sr-only" htmlFor={`task-title-${matter.id}`}>New task name</label>
                    <input
                      id={`task-title-${matter.id}`}
                      value={taskTitles[matter.id] ?? ''}
                      onChange={(event) => setTaskTitles((current) => ({ ...current, [matter.id]: event.target.value }))}
                      maxLength={160}
                      required
                      placeholder="Add a follow-up task"
                      className="min-h-10 rounded-lg border border-ink-100 px-3 text-sm text-ink placeholder:text-ink-400 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
                    />
                    <label className="sr-only" htmlFor={`task-date-${matter.id}`}>Optional reminder date</label>
                    <input
                      id={`task-date-${matter.id}`}
                      type="date"
                      value={taskDates[matter.id] ?? ''}
                      onChange={(event) => setTaskDates((current) => ({ ...current, [matter.id]: event.target.value }))}
                      className="min-h-10 rounded-lg border border-ink-100 px-3 text-sm text-ink focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
                    />
                    <button
                      type="submit"
                      disabled={savingTask === matter.id}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brass/40 hover:bg-paper disabled:opacity-50"
                    >
                      {savingTask === matter.id ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
                      Add task
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-ink-400">
        <Check size={14} className="mt-0.5 shrink-0 text-brass-600" />
        Your matter records are separate from the verified legal corpus and are not used to generate legal answers.
      </p>
    </div>
  )
}

function localDateString(): string {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(year, month - 1, day))
}
