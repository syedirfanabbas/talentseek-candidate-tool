'use client'

import { useState } from 'react'
import { GettingStartedAnswers, QUESTIONS } from '../../lib/gettingStarted'

type Props = {
  initial?: Partial<GettingStartedAnswers>
  saving: boolean
  onSubmit: (answers: GettingStartedAnswers) => void
  onSkip: () => void
}

// D15: three one-tap questions shown on Home until answered or skipped.
export function GettingStarted({ initial, saving, onSubmit, onSkip }: Props) {
  const [answers, setAnswers] = useState<Partial<GettingStartedAnswers>>(initial || {})
  const complete = Boolean(answers.has_resume && answers.experience && answers.need)

  return (
    <section aria-labelledby='getting-started-title' className='mt-10 rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm sm:p-8'>
      <p className='text-xs font-semibold uppercase tracking-wider text-teal-700'>Getting started</p>
      <h2 id='getting-started-title' className='mt-2 text-2xl font-bold text-slate-900'>Three quick questions, and we’ll suggest where to start.</h2>
      <div className='mt-6 space-y-6'>
        {QUESTIONS.map(({ key, question, options }) => (
          <fieldset key={key}>
            <legend className='font-semibold text-slate-900'>{question}</legend>
            <div className='mt-3 flex flex-wrap gap-2'>
              {options.map(option => {
                const selected = answers[key] === option.value
                return (
                  <button key={option.value} type='button' aria-pressed={selected}
                    onClick={() => setAnswers({ ...answers, [key]: option.value })}
                    className={`rounded-full border px-4 py-2 text-sm ${selected ? 'border-teal-700 bg-teal-700 font-semibold text-white' : 'border-slate-300 text-slate-700 hover:border-slate-500'}`}>
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className='mt-8 flex flex-wrap items-center gap-4'>
        <button type='button' disabled={!complete || saving} onClick={() => complete && onSubmit(answers as GettingStartedAnswers)}
          className='rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40'>
          {saving ? 'Saving…' : 'Show my starting point'}
        </button>
        <button type='button' onClick={onSkip} disabled={saving} className='text-sm font-medium text-slate-500 hover:text-slate-800'>Skip for now</button>
      </div>
    </section>
  )
}
