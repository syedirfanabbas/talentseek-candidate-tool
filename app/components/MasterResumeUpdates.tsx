
'use client'

import { useEffect, useState } from 'react'
import { MAX_UPDATE_CHARACTERS } from '../../lib/masterResumeInputs'

export function MasterResumeUpdates({ value, onChange, updateFlow, disabled }: {
  value: string; onChange: (value: string) => void; updateFlow: boolean; disabled: boolean
}) {
  const [expanded, setExpanded] = useState(updateFlow)
  useEffect(() => { if (updateFlow) setExpanded(true) }, [updateFlow])
  return <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className='mb-4 rounded-xl border border-teal-200 bg-teal-50 p-4'>
    <summary className='cursor-pointer font-semibold text-slate-900'>Add or correct details <span className='text-sm font-normal text-slate-600'>(optional)</span></summary>
    {updateFlow && <ol className='mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700'>
      <li>Upload your old resume.</li><li>Type what’s new, and anything to change or remove, below. You don’t need a second file.</li><li>Build and review your master resume, then tailor it to a job.</li>
    </ol>}
    <label htmlFor='career-updates' className='mt-4 block text-sm font-semibold text-slate-800'>New details and corrections</label>
    <div id='career-updates-hints' className='mt-2 space-y-2 text-sm leading-6 text-slate-700'>
      <p>For each recent role: title, company, city, start/end dates, and whether it is current, ended, or held at the same time as another job. Give the end date of any job on your old resume that has ended.</p>
      <p>Add new skills, certifications and courses. Include a few achievements if you have them (optional). Write only details you want included; leave unknown dates blank for review.</p>
      <p>You can also correct or remove details, for example: “Change the dates for ABC Ltd to 2012–2019” or “Remove the supervisor’s name under ABC Ltd”.</p>
    </div>
    <textarea id='career-updates' aria-describedby='career-updates-hints career-updates-privacy' value={value} onChange={event => onChange(event.target.value)} disabled={disabled} maxLength={MAX_UPDATE_CHARACTERS}
      className='mt-3 min-h-52 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60'
      placeholder={'Recent role: title, company, city\nDates: start – end or Present\nStatus: current / ended / held at the same time as another job\nAchievements (optional):\nEnd dates for old roles that have ended:\nNew skills, certifications or courses:\nCorrections (optional): change … to … / remove …'} />
    <p id='career-updates-privacy' className='mt-2 text-xs leading-5 text-slate-600'>Your notes are used to build the result and are not saved separately. Details included in the master resume are stored when you choose Save to account.</p>
  </details>
}
