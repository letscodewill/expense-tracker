'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ActivityTracker() {
  useEffect(() => {
    let stopped = false, busy = false, lastAttempt = 0
    const supabase = createClient()
    async function record() {
      if (stopped || busy || document.visibilityState !== 'visible' || Date.now() - lastAttempt < 300000) return
      busy = true; lastAttempt = Date.now()
      try { await supabase.rpc('record_user_visit') } catch { /* Activity must never block use of the app. */ }
      finally { busy = false }
    }
    void record()
    const timer = window.setInterval(() => void record(), 300000)
    const resume = () => void record()
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume) }
  }, [])
  return null
}
