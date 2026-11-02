'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/components/language-provider'
import { META_PIXEL_ID, MARKETING_CONSENT_KEY, MARKETING_CONSENT_COOKIE, MARKETING_CONSENT_EVENT, validMarketingChoice, isMarketingLocation, trackMarketingEvent, type MarketingChoice, type MetaQueue } from '@/lib/meta-marketing'

const copy = {
  'pt-BR': {title:'Medição de anúncios',body:'Podemos usar o Pixel da Meta para medir visitas, cadastros e assinaturas. Suas despesas, salário e documentos não são enviados. Você pode recusar e continuar usando o site.',accept:'Permitir',reject:'Recusar',settings:'Privacidade dos anúncios',policy:'Política de privacidade'},
  en:{title:'Ad measurement',body:'May we use the Meta Pixel to measure visits, registrations and subscriptions? Your expenses, salary and documents are not shared. You can decline and continue using the site.',accept:'Allow',reject:'Decline',settings:'Ad privacy',policy:'Privacy policy'},
  es:{title:'Medición de anuncios',body:'Podemos usar el píxel de Meta para medir visitas, registros y suscripciones. No compartimos tus gastos, salario ni documentos. Puedes rechazar y seguir usando el sitio.',accept:'Permitir',reject:'Rechazar',settings:'Privacidad de anuncios',policy:'Política de privacidad'},
}
export function MetaMarketing() {
  const pathname = usePathname(), {language} = useLanguage(), text = copy[language]
  const [choice,setChoice] = useState<MarketingChoice|null>(null), [ready,setReady] = useState(false), [show,setShow] = useState(false)
  const lastPage = useRef(''), pending = useRef(false)
  const publicPage = ['/welcome','/login','/plans'].includes(pathname)
  useEffect(()=>{
    const sync=()=>{const value=validMarketingChoice(localStorage.getItem(MARKETING_CONSENT_KEY));setChoice(value);setShow(value===null);setReady(true)}
    try {sync()} catch {setReady(true);setShow(true)}
    window.addEventListener('storage',sync)
    return ()=>window.removeEventListener('storage',sync)
  },[])
  function decide(value:MarketingChoice) {
    try {localStorage.setItem(MARKETING_CONSENT_KEY,JSON.stringify({choice:value,at:Date.now()}))} catch {}
    document.cookie=`${MARKETING_CONSENT_COOKIE}=${value}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`
    setChoice(value);setShow(false)
    if(value==='denied') {
      window.fbq?.('consent','revoke');lastPage.current=''
      for(const name of ['_fbp','_fbc']) for(const domain of ['',`; Domain=${location.hostname}`,`; Domain=.${location.hostname.split('.').slice(-3).join('.')}`]) document.cookie=`${name}=; Path=/; Max-Age=0${domain}`
    }
    window.dispatchEvent(new Event(MARKETING_CONSENT_EVENT))
  }
  useEffect(()=>{
    if (!ready || choice !== 'granted' || !publicPage) {window.fbq?.('consent','revoke');return}
    // Remove the Stripe return parameters BEFORE loading any third-party script.
    const url = new URL(location.href), session = url.searchParams.get('session_id')
    if(pathname==='/plans' && url.searchParams.get('checkout')==='success' && session && /^cs_(live|test)_[A-Za-z0-9]{1,200}$/.test(session)) {
      try {sessionStorage.setItem('nocontrole:purchase-pending',session)} catch {}
      history.replaceState(history.state,'',url.pathname)
    }
    if(!isMarketingLocation(location.href)) {window.fbq?.('consent','revoke');return}
    if(!window.fbq) {
      const queue = function(...args:unknown[]) {if(queue.callMethod)queue.callMethod(...args);else queue.queue.push(args)} as MetaQueue
      queue.queue=[];queue.push=queue;queue.loaded=true;queue.version='2.0';window.fbq=queue;window._fbq=queue
      queue('consent','grant');queue('set','autoConfig',false,META_PIXEL_ID);queue('init',META_PIXEL_ID)
      const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';script.id='nocontrole-meta-pixel';document.head.appendChild(script)
    } else window.fbq('consent','grant')
    if(lastPage.current!==pathname) {window.fbq('trackSingle',META_PIXEL_ID,'PageView');lastPage.current=pathname}
    if(pending.current)return
    pending.current=true
    const controller=new AbortController()
    async function conversions() {
      try {
        const stored=sessionStorage.getItem('nocontrole:purchase-pending')
        for(const action of ['registration',...(pathname==='/plans' && stored?['purchase']:[])]) {
          const response=await fetch('/api/marketing/conversion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(action==='purchase'?{session:stored}:{})}),signal:controller.signal})
          if(!response.ok)continue
          const {event}=await response.json()
          if(!event || !/^[a-f0-9]{64}$/.test(event.eventID))continue
          const key=`nocontrole:meta:${event.eventID}`
          if(localStorage.getItem(key)==='1')continue
          if(trackMarketingEvent(action==='purchase'?'Purchase':'CompleteRegistration',event,event.eventID)) {
            localStorage.setItem(key,'1')
            if(action==='purchase')sessionStorage.removeItem('nocontrole:purchase-pending')
          }
        }
      } catch { /* Tracking never blocks login, checkout or application use. */ }
      finally {pending.current=false}
    }
    void conversions()
    return ()=>{controller.abort();pending.current=false}
  },[pathname,choice,ready,publicPage])
  if(!ready || !publicPage)return null
  return <>
    <button type="button" onClick={()=>setShow(true)} className="fixed bottom-2 left-2 z-40 rounded-full border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm">{text.settings}</button>
    {show && <section aria-label={text.title} className="fixed bottom-12 left-3 right-3 z-[100] max-w-lg rounded-2xl border bg-card p-5 text-card-foreground shadow-xl sm:left-4 sm:right-auto">
      <h2 className="font-semibold">{text.title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text.body}</p>
      <Link href="/privacypolicy" className="mt-2 inline-block text-xs underline">{text.policy}</Link>
      <div className="mt-4 flex gap-3"><button type="button" onClick={()=>decide('denied')} className="flex-1 rounded-full border px-4 py-2 text-sm">{text.reject}</button><button type="button" onClick={()=>decide('granted')} className="flex-1 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">{text.accept}</button></div>
    </section>}
  </>
}
