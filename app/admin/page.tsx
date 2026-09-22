'use client'

import { useState, useEffect } from 'react'

type UsageLog = {
  id: string
  endpoint: string
  model_used: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  created_at: string
}

type Summary = {
  total_input: number
  total_output: number
  total_tokens: number
  total_cost: number
  total_calls: number
  by_model: Record<string, { calls: number; input: number; output: number; cost: number }>
  by_endpoint: Record<string, { calls: number; input: number; output: number; cost: number }>
  by_day: Record<string, { calls: number; tokens: number; cost: number }>
}

const ADMIN_PASSWORD = 'talentseek2026'

export default function AdminDashboard() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'endpoints' | 'daily' | 'logs'>('overview')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true)
      setAuthError('')
    } else {
      setAuthError('Incorrect password')
    }
  }

  const fetchUsage = async () => {
    setIsLoading(true); setError('')
    try {
      const res = await fetch(`${API_URL}/admin/usage`)
      if (!res.ok) throw new Error('Failed to fetch usage data')
      const data = await res.json()
      setLogs(data.logs || [])
      setSummary(data.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data')
    } finally { setIsLoading(false) }
  }

  useEffect(() => {
    if (authenticated) fetchUsage()
  }, [authenticated])

  if (!authenticated) {
    return (
      <main className='min-h-screen bg-slate-50 flex items-center justify-center px-6'>
        <div className='w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm'>
          <div className='mb-6 text-center'>
            <h1 className='text-2xl font-bold text-slate-900'>TalentSeek Admin</h1>
            <p className='mt-2 text-sm text-slate-500'>Usage Dashboard</p>
          </div>
          <input
            type='password'
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder='Enter admin password'
            className='mb-3 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-slate-500'
          />
          {authError && <p className='mb-3 text-sm text-red-600'>{authError}</p>}
          <button onClick={handleLogin}
            className='w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800'>
            Sign In
          </button>
        </div>
      </main>
    )
  }

  const fmt = (n: number) => n.toLocaleString()
  const fmtCost = (n: number) => `$${n.toFixed(4)}`
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const modelColor: Record<string, string> = {
    'claude-haiku-4-5-20251001': 'bg-green-100 text-green-700',
    'claude-sonnet-4-6': 'bg-blue-100 text-blue-700',
  }

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-10'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-8 flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-slate-900'>Usage Dashboard</h1>
            <p className='mt-1 text-slate-500'>TalentSeek AI — Token and Cost Tracking</p>
          </div>
          <div className='flex gap-3'>
            <button onClick={fetchUsage}
              className='rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100'>
              🔄 Refresh
            </button>
            <a href='/admin/prompts'
              className='rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100'>
              ✏️ Prompt Editor
            </a>
            <a href='/recruiter'
              className='rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100'>
              🎯 Recruiter Console
            </a>
            <a href='/'
              className='rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100'>
              ← Back to App
            </a>
          </div>
        </div>

        {isLoading && (
          <div className='flex items-center justify-center py-20'>
            <p className='text-slate-500'>Loading usage data...</p>
          </div>
        )}

        {error && (
          <div className='mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700'>
            {error} — Make sure the backend /admin/usage endpoint is running.
          </div>
        )}

        {summary && (
          <>
            {/* Top stats */}
            <div className='mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {[
                { label: 'Total API Calls', value: fmt(summary.total_calls), icon: '📡' },
                { label: 'Total Tokens Used', value: fmt(summary.total_tokens), icon: '🔢' },
                { label: 'Total Cost (USD)', value: fmtCost(summary.total_cost), icon: '💰' },
                { label: 'Avg Tokens / Call', value: summary.total_calls > 0 ? fmt(Math.round(summary.total_tokens / summary.total_calls)) : '0', icon: '📊' },
              ].map(stat => (
                <div key={stat.label} className='rounded-2xl bg-white p-5 shadow-sm'>
                  <p className='text-2xl mb-1'>{stat.icon}</p>
                  <p className='text-2xl font-bold text-slate-900'>{stat.value}</p>
                  <p className='text-sm text-slate-500'>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Token breakdown */}
            <div className='mb-6 grid gap-4 sm:grid-cols-2'>
              <div className='rounded-2xl bg-white p-5 shadow-sm'>
                <h3 className='mb-3 font-semibold text-slate-800'>Token Breakdown</h3>
                <div className='space-y-3'>
                  <div>
                    <div className='mb-1 flex justify-between text-sm'>
                      <span className='text-slate-600'>Input tokens</span>
                      <span className='font-medium'>{fmt(summary.total_input)}</span>
                    </div>
                    <div className='h-2 rounded-full bg-slate-100'>
                      <div className='h-2 rounded-full bg-blue-400' style={{ width: `${(summary.total_input / summary.total_tokens) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 flex justify-between text-sm'>
                      <span className='text-slate-600'>Output tokens</span>
                      <span className='font-medium'>{fmt(summary.total_output)}</span>
                    </div>
                    <div className='h-2 rounded-full bg-slate-100'>
                      <div className='h-2 rounded-full bg-emerald-400' style={{ width: `${(summary.total_output / summary.total_tokens) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className='rounded-2xl bg-white p-5 shadow-sm'>
                <h3 className='mb-3 font-semibold text-slate-800'>Cost by Model</h3>
                <div className='space-y-2'>
                  {Object.entries(summary.by_model).map(([model, data]) => (
                    <div key={model} className='flex items-center justify-between'>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${modelColor[model] || 'bg-slate-100 text-slate-700'}`}>
                        {model.replace('claude-', '').replace('-20251001', '')}
                      </span>
                      <div className='text-right text-sm'>
                        <span className='font-medium'>{fmtCost(data.cost)}</span>
                        <span className='ml-2 text-slate-400'>{fmt(data.calls)} calls</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className='rounded-2xl bg-white shadow-sm'>
              <div className='flex border-b border-slate-200'>
                {(['overview', 'models', 'endpoints', 'daily', 'logs'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                      activeTab === tab
                        ? 'border-b-2 border-slate-900 text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>

              <div className='p-6'>
                {activeTab === 'overview' && (
                  <div className='space-y-3'>
                    <h3 className='font-semibold text-slate-800 mb-4'>Usage Summary</h3>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b border-slate-200 text-left text-slate-500'>
                          <th className='pb-2'>Metric</th>
                          <th className='pb-2 text-right'>Value</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-slate-100'>
                        {[
                          ['Total API Calls', fmt(summary.total_calls)],
                          ['Total Input Tokens', fmt(summary.total_input)],
                          ['Total Output Tokens', fmt(summary.total_output)],
                          ['Total Tokens', fmt(summary.total_tokens)],
                          ['Total Cost (USD)', fmtCost(summary.total_cost)],
                          ['Avg Cost per Call', fmtCost(summary.total_cost / Math.max(summary.total_calls, 1))],
                        ].map(([label, value]) => (
                          <tr key={label}>
                            <td className='py-2 text-slate-600'>{label}</td>
                            <td className='py-2 text-right font-medium'>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'models' && (
                  <div>
                    <h3 className='font-semibold text-slate-800 mb-4'>Usage by Model</h3>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b border-slate-200 text-left text-slate-500'>
                          <th className='pb-2'>Model</th>
                          <th className='pb-2 text-right'>Calls</th>
                          <th className='pb-2 text-right'>Input</th>
                          <th className='pb-2 text-right'>Output</th>
                          <th className='pb-2 text-right'>Cost</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-slate-100'>
                        {Object.entries(summary.by_model).map(([model, data]) => (
                          <tr key={model}>
                            <td className='py-2'>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${modelColor[model] || 'bg-slate-100 text-slate-700'}`}>
                                {model.replace('claude-', '').replace('-20251001', '')}
                              </span>
                            </td>
                            <td className='py-2 text-right'>{fmt(data.calls)}</td>
                            <td className='py-2 text-right'>{fmt(data.input)}</td>
                            <td className='py-2 text-right'>{fmt(data.output)}</td>
                            <td className='py-2 text-right font-medium'>{fmtCost(data.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'endpoints' && (
                  <div>
                    <h3 className='font-semibold text-slate-800 mb-4'>Usage by Endpoint</h3>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b border-slate-200 text-left text-slate-500'>
                          <th className='pb-2'>Endpoint</th>
                          <th className='pb-2 text-right'>Calls</th>
                          <th className='pb-2 text-right'>Tokens</th>
                          <th className='pb-2 text-right'>Cost</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-slate-100'>
                        {Object.entries(summary.by_endpoint).sort((a, b) => b[1].calls - a[1].calls).map(([ep, data]) => (
                          <tr key={ep}>
                            <td className='py-2 font-mono text-xs text-slate-600'>{ep}</td>
                            <td className='py-2 text-right'>{fmt(data.calls)}</td>
                            <td className='py-2 text-right'>{fmt(data.input + data.output)}</td>
                            <td className='py-2 text-right font-medium'>{fmtCost(data.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'daily' && (
                  <div>
                    <h3 className='font-semibold text-slate-800 mb-4'>Daily Usage</h3>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b border-slate-200 text-left text-slate-500'>
                          <th className='pb-2'>Date</th>
                          <th className='pb-2 text-right'>Calls</th>
                          <th className='pb-2 text-right'>Tokens</th>
                          <th className='pb-2 text-right'>Cost</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-slate-100'>
                        {Object.entries(summary.by_day).sort((a, b) => b[0].localeCompare(a[0])).map(([day, data]) => (
                          <tr key={day}>
                            <td className='py-2 text-slate-600'>{day}</td>
                            <td className='py-2 text-right'>{fmt(data.calls)}</td>
                            <td className='py-2 text-right'>{fmt(data.tokens)}</td>
                            <td className='py-2 text-right font-medium'>{fmtCost(data.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div>
                    <h3 className='font-semibold text-slate-800 mb-4'>Recent API Calls</h3>
                    <div className='overflow-x-auto'>
                      <table className='w-full text-sm'>
                        <thead>
                          <tr className='border-b border-slate-200 text-left text-slate-500'>
                            <th className='pb-2'>Time</th>
                            <th className='pb-2'>Endpoint</th>
                            <th className='pb-2'>Model</th>
                            <th className='pb-2 text-right'>In</th>
                            <th className='pb-2 text-right'>Out</th>
                            <th className='pb-2 text-right'>Cost</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-slate-100'>
                          {logs.slice(0, 50).map((log, i) => (
                            <tr key={i}>
                              <td className='py-2 text-xs text-slate-400 whitespace-nowrap'>{fmtDate(log.created_at)}</td>
                              <td className='py-2 font-mono text-xs text-slate-600'>{log.endpoint}</td>
                              <td className='py-2'>
                                <span className={`rounded-full px-2 py-0.5 text-xs ${modelColor[log.model_used] || 'bg-slate-100 text-slate-600'}`}>
                                  {log.model_used?.replace('claude-', '').replace('-20251001', '')}
                                </span>
                              </td>
                              <td className='py-2 text-right text-xs'>{fmt(log.input_tokens)}</td>
                              <td className='py-2 text-right text-xs'>{fmt(log.output_tokens)}</td>
                              <td className='py-2 text-right text-xs font-medium'>{fmtCost(log.cost_usd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
