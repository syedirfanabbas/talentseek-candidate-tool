'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

const PROMPT_KEYS = [
  {
    key: 'resume_prompt',
    label: 'Resume Optimization Prompt',
    description: 'Controls how Claude rewrites and formats resumes. This prompt is stored securely in Supabase.',
    color: 'blue',
  },
]

const PROMPT_GUIDES: Record<string, string[]> = {
  resume_prompt: [
    'CONTENT RULES — what Claude should highlight, cut, or rewrite',
    'STRUCTURE RULES — section order: summary, competencies, experience, education',
    'FORMATTING RULES — name on line 1, ALL CAPS headings, dash bullets, pipe skills',
    'LENGTH instruction — word count targets per page setting',
  ],
}

export default function PromptEditor() {

  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [activeKey, setActiveKey] = useState('resume_prompt')
  const [editContent, setEditContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const fetchPrompts = async () => {
    setIsLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) throw new Error('Please sign in again')

      const res = await fetch(`${API_URL}/admin/prompts`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 403) throw new Error('Admin access required')
      if (!res.ok) throw new Error('Failed to fetch prompts')
      const data = await res.json()
      setPrompts(data)
      setEditContent(data[activeKey] || '')
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Failed to load prompts', type: 'error' })
    } finally { setIsLoading(false) }
  }

  useEffect(() => {
    fetchPrompts()
  }, [])

  useEffect(() => {
    setEditContent(prompts[activeKey] || '')
    setIsDirty(false)
  }, [activeKey, prompts])

  const handleChange = (val: string) => {
    setEditContent(val)
    setIsDirty(val !== (prompts[activeKey] || ''))
  }

  const handleSave = async () => {
    setIsSaving(true); setMessage(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) throw new Error('Please sign in again')

      const res = await fetch(`${API_URL}/admin/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt_key: activeKey, content: editContent }),
      })

      if (res.status === 403) throw new Error('Admin access required')
      const data = await res.json()
      if (data.success) {
        setPrompts(prev => ({ ...prev, [activeKey]: editContent }))
        setIsDirty(false)
        setMessage({ text: 'Saved successfully. Changes take effect immediately.', type: 'success' })
      } else {
        setMessage({ text: data.message || 'Save failed', type: 'error' })
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Save failed', type: 'error' })
    } finally { setIsSaving(false) }
  }

  const handleReset = () => {
    setEditContent(prompts[activeKey] || '')
    setIsDirty(false)
    setMessage(null)
  }

  const activePrompt = PROMPT_KEYS.find(p => p.key === activeKey)


  return (
    <main className='min-h-screen bg-slate-50'>
      {/* Header */}
      <div className='border-b border-slate-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-7xl flex items-center justify-between'>
          <div>
            <p className='text-xs font-medium uppercase tracking-widest text-slate-400'>TalentSeek Admin</p>
            <h1 className='text-xl font-bold text-slate-900'>Prompt Editor</h1>
          </div>
          <div className='flex gap-3'>
            <a href='/admin' className='rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'>
              Usage Dashboard
            </a>
            <a href='/admin/dashboard' className='rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'>
              ← Admin Home
            </a>
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-7xl px-6 py-8'>
        <div className='grid gap-6 lg:grid-cols-4'>

          {/* Sidebar */}
          <div className='lg:col-span-1'>
            <div className='rounded-2xl bg-white p-4 shadow-sm'>
              <h2 className='mb-3 text-sm font-semibold text-slate-700'>Prompts</h2>
              <div className='space-y-2'>
                {PROMPT_KEYS.map(p => (
                  <button key={p.key} onClick={() => {
                    if (isDirty && !confirm('You have unsaved changes. Switch anyway?')) return
                    setActiveKey(p.key); setMessage(null)
                  }}
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      activeKey === p.key
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}>
                    <p className='font-medium'>{p.label}</p>
                    <p className={`text-xs mt-0.5 ${activeKey === p.key ? 'text-slate-300' : 'text-slate-400'}`}>
                      {p.description.slice(0, 50)}...
                    </p>
                  </button>
                ))}
              </div>

              <div className='mt-4 rounded-xl border border-slate-200 p-3'>
                <p className='mb-2 text-xs font-semibold text-slate-600'>Quick Reference</p>
                <ul className='space-y-1.5'>
                  {(PROMPT_GUIDES[activeKey] || []).map((tip, i) => (
                    <li key={i} className='text-xs text-slate-500 leading-relaxed'>• {tip}</li>
                  ))}
                </ul>
              </div>

              <div className='mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3'>
                <p className='text-xs font-semibold text-amber-800 mb-1'>⚠️ Important</p>
                <p className='text-xs text-amber-700'>Changes save to Supabase immediately and affect all future optimizations. Test after saving.</p>
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className='lg:col-span-3'>
            <div className='rounded-2xl bg-white shadow-sm'>
              {/* Editor header */}
              <div className='flex items-center justify-between border-b border-slate-200 px-5 py-4'>
                <div>
                  <h2 className='font-semibold text-slate-900'>{activePrompt?.label}</h2>
                  <p className='text-sm text-slate-500'>{activePrompt?.description}</p>
                </div>
                <div className='flex items-center gap-3'>
                  {isDirty && (
                    <span className='rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700'>
                      Unsaved changes
                    </span>
                  )}
                  <button onClick={handleReset} disabled={!isDirty || isSaving}
                    className='rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40'>
                    Reset
                  </button>
                  <button onClick={handleSave} disabled={!isDirty || isSaving}
                    className='rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40'>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Message */}
              {message && (
                <div className={`mx-5 mt-4 rounded-xl p-3 text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Textarea */}
              {isLoading ? (
                <div className='flex items-center justify-center py-20 text-slate-400'>
                  Loading prompt...
                </div>
              ) : (
                <div className='p-5'>
                  <textarea
                    value={editContent}
                    onChange={e => handleChange(e.target.value)}
                    spellCheck={false}
                    className='w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white transition-colors'
                    style={{ minHeight: '65vh', resize: 'vertical' }}
                  />
                  <div className='mt-2 flex justify-between text-xs text-slate-400'>
                    <span>{editContent.split('\n').length} lines</span>
                    <span>{editContent.length} characters</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
