import { PRIVACY_URL } from '../../lib/legal'

// Cross-border processing disclosure (PIPEDA, UAE and Saudi PDPL) shown wherever resume text is entered.
export function AiProcessingNotice() {
  return (
    <p className='mt-2 text-xs leading-5 text-slate-500'>
      Your resume is processed by AI (Anthropic) on servers in the United States to create your results. It is not shared with employers.
      {' '}See our <a href={PRIVACY_URL} target='_blank' rel='noopener noreferrer' className='underline hover:text-slate-700'>Privacy Policy</a>.
    </p>
  )
}
