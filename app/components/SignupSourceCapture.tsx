'use client'

import { useEffect } from 'react'
import { getBrowserSignupSource } from '../../lib/signupSource'

export function SignupSourceCapture() {
  useEffect(() => { getBrowserSignupSource() }, [])
  return null
}
