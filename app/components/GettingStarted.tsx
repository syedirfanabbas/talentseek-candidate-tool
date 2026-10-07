'use client'

import { useState } from 'react'
import { GettingStartedAnswers, QUESTIONS } from '../../lib/gettingStarted'

type Props = {
  initial?: Partial<GettingStartedAnswers>
  saving: boolean
  onSubmit: (answers: GettingStartedAnswers) => void
  onSkip: () => void
}

// D15: three questions, one at a time, shown on Home until answered or skipped.
// Tapping an answer moves on; the last answer submits.
export function GettingStarted({ initial, saving, onSubmit, onSkip }: Props) {
  const [answers, setAnswers] = useState<Partial<GettingStartedAnswers>>(initial || {})
  const [step, setStep] = useState(0)
  const { key, question, options } = QUESTIONS[step]
  const last = step === QUESTIONS.length - 1

  function choose(value: string) {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    if (last) onSubmit(next as GettingStartedAnswers)
    else setTimeout(() => setStep(step + 1), 180) // let the selection show before moving on
  }

  return (
    <section aria-labelledby='getting-started-title' className='mt-10 overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-200'>
      <div className='bg-gradient-to-br from-slate-900 via-slate-800 to-teal-800 px-6 py-7 text-white sm:px-10'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-xs font-semibold uppercase tracking-widest text-teal-200'>Let’s find your starting point</p>
          <p className='rounded-full bg-white/10 px-3 py-1 text-xs text-teal-50'>⏱ Takes about 20 seconds</p>
        </div>
        <h2 id='getting-started-title' className='mt-3 text-2xl font-bold sm:text-3xl'>{question}</h2>
        <div className='mt-5 flex items-center gap-3' aria-label={`Step ${step + 1} of ${QUESTIONS.length}`}>
          <div className='flex flex-1 gap-2'>
            {QUESTIONS.map((_, index) => (
              <span key={index} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${index <= step ? 'bg-teal-300' : 'bg-white/20'}`} />
            ))}
          </div>
          <span className='text-xs font-medium text-teal-100'>Step {step + 1} of {QUESTIONS.length}</span>
        </div>
      </div>

      <div className='px-6 py-7 sm:px-10'>
        <div key={step} className='grid animate-[fadeIn_250ms_ease-out] gap-3 sm:grid-cols-2'>
          {options.map(option => {
            const selected = answers[key] === option.value
            return (
              <button key={option.value} type='button' aria-pressed={selected} disabled={saving} onClick={() => choose(option.value)}
                className={`group flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 ${selected ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-400'}`}>
                <span aria-hidden='true' className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl transition ${selected ? 'bg-teal-600/15' : 'bg-slate-100 group-hover:bg-teal-50'}`}>{option.icon}</span>
                <span className='font-semibold text-slate-900'>{option.label}</span>
                {selected && <span aria-hidden='true' className='ml-auto text-lg text-teal-700'>✓</span>}
              </button>
            )
          })}
        </div>

        <div className='mt-7 flex flex-wrap items-center justify-between gap-4 text-sm'>
          {step > 0
            ? <button type='button' onClick={() => setStep(step - 1)} disabled={saving} className='font-medium text-slate-600 hover:text-slate-900'>← Back</button>
            : <span />}
          {saving
            ? <span role='status' className='font-medium text-teal-800'>Finding your starting point…</span>
            : <button type='button' onClick={onSkip} className='font-medium text-slate-400 hover:text-slate-700'>Skip for now</button>}
        </div>
      </div>
    </section>
  )
}
