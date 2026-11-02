'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/language-provider'
import { SavingsPanel } from '@/components/savings-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
export function SavingsHub({ goals: initialGoals, pro, loadError = false }: { goals: {id:string;name:string}[]; pro:boolean; loadError?: boolean }) {
  const {t}=useLanguage()
  const [goals,setGoals]=useState(initialGoals),[selected,setSelected]=useState(''),[name,setName]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false), attempt=useRef<{id:string;name:string}|null>(null),inFlight=useRef(false)
  async function create() {
    if(inFlight.current || !name.trim() || loadError) return
    inFlight.current=true;setBusy(true);setError('')
    const current=attempt.current ?? {id:crypto.randomUUID(),name:name.trim()};attempt.current=current
    try{
      const result=await createClient().rpc('savings_extra_action',{action_input:'create',goal_input:current.id,name_input:current.name})
      if(result.error || !result.data) {
        if(result.error && ['22023','42501'].includes(result.error.code)) attempt.current=null
        throw new Error('save')
      }
      setGoals(previous=>previous.some(g=>g.id===result.data.id)?previous:[...previous,{id:result.data.id,name:result.data.name}])
      setSelected(result.data.id);setName('');attempt.current=null;setUncertain(false)
    }catch{setUncertain(attempt.current!==null);setError('Não foi possível confirmar a nova meta. Tente novamente para verificar a mesma operação.')}
    finally{inFlight.current=false;setBusy(false)}
  }
  return <div className="space-y-5">
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <label className="block space-y-2 text-sm"><span>{t('Selecionar meta')}</span><select className="w-full rounded-xl border bg-background p-3" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}><option value="">{t('Meu cofrinho')}</option>{goals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      {pro ? <form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();void create()}}><Input className="min-w-0 flex-1" aria-label={t('Nome da nova meta')} value={name} maxLength={80} disabled={busy||uncertain||loadError} onChange={e=>setName(e.target.value)} placeholder={t('Nome da nova meta')} /><Button type="submit" disabled={busy||!name.trim()||loadError}>{t(uncertain?'Tentar novamente':'Criar meta')}</Button></form>
        : <Link href="/plans" className="text-sm text-primary underline">{t('Várias metas estão disponíveis no Total.')}</Link>}
      {loadError && <p role="alert" className="text-sm text-destructive">{t('Não foi possível carregar suas metas adicionais. Atualize a página para tentar novamente.')}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    </section>
    <SavingsPanel key={selected||'primary'} goalId={selected||undefined} />
  </div>
}
