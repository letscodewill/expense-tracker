'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Popover } from '@base-ui/react/popover'
import { ArrowLeft, Mail, X } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/components/language-provider'
import { GoogleSignInButton } from '@/components/google-signin-button'
import { LoginSubmitButton } from '@/components/login-submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const mobileQuery = '(max-width: 639px)'
function subscribeScreen(listener: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener('change',listener)
  return () => query.removeEventListener('change',listener)
}
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches

export function LoginAccess({ action }: { action: (formData: FormData) => Promise<void> }) {
  const { t } = useLanguage()
  const mobile = useSyncExternalStore(subscribeScreen,mobileSnapshot,()=>false)
  const [open,setOpen] = useState(false), [emailMode,setEmailMode] = useState(false)
  const [email,setEmail] = useState(''), [password,setPassword] = useState('')
  const emailInput = useRef<HTMLInputElement>(null)
  const emailMethod = useRef<HTMLButtonElement>(null), wasEmailMode = useRef(false)
  function changeOpen(value: boolean) {
    setOpen(value)
    if(!value) {setEmailMode(false);setEmail('');setPassword('')}
  }
  useEffect(()=>{
    if(open&&emailMode) emailInput.current?.focus()
    else if(open&&wasEmailMode.current) emailMethod.current?.focus()
    wasEmailMode.current=emailMode
  },[open,emailMode,mobile])

  const content = <div className="space-y-5">
    {emailMode ? <>
      <Button type="button" variant="ghost" size="sm" onClick={()=>{setEmailMode(false);setPassword('')}}><ArrowLeft className="size-4" />{t('Outras formas de entrar')}</Button>
      <form action={action} className="login-email-reveal space-y-4">
        <div className="space-y-2"><Label htmlFor="access-email">{t('E-mail')}</Label><Input ref={emailInput} id="access-email" name="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="access-password">{t('Senha')}</Label><Input id="access-password" name="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
        <div className="text-right"><Link href="/login?mode=recover" className="text-sm font-medium text-primary hover:underline">{t('Esqueceu a senha?')}</Link></div>
        <LoginSubmitButton />
      </form>
    </> : <div className="space-y-3"><GoogleSignInButton /><Button ref={emailMethod} type="button" variant="outline" className="w-full gap-3" onClick={()=>setEmailMode(true)}><Mail className="size-4" />{t('Entrar com e-mail')}</Button></div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs">
      <Link href="/login?mode=signup" className="font-medium text-primary hover:underline" onClick={()=>changeOpen(false)}>{t('Criar conta')}</Link>
      <Link href="/login?mode=email" className="text-muted-foreground hover:underline">{t('Abrir página de acesso')}</Link>
    </div>
  </div>
  const title=t(emailMode?'Entrar com e-mail':'Entre no NoControle')
  const description=t('Escolha como deseja acessar sua conta.')
  const trigger=<Button type="button" className="min-h-10 px-5">{t('Entrar')}</Button>
  if(mobile) return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger render={trigger} />
    <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl p-6 sm:max-w-sm">
      <DialogHeader className="pr-6"><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {content}
    </DialogContent>
  </Dialog>
  return <Popover.Root open={open} onOpenChange={changeOpen}>
    <Popover.Trigger render={trigger} />
    <Popover.Portal><Popover.Positioner side="bottom" align="end" sideOffset={12} collisionPadding={16} className="z-50">
      <Popover.Popup className="login-access-popup relative w-[min(24rem,calc(100vw-2rem))] max-h-[min(42rem,calc(100dvh-7rem))] overflow-y-auto rounded-3xl border bg-card p-6 text-card-foreground shadow-2xl outline-none">
        <div className="mb-5 space-y-2 pr-6"><Popover.Title className="text-lg font-semibold">{title}</Popover.Title><Popover.Description className="text-sm text-muted-foreground">{description}</Popover.Description></div>
        <Popover.Close render={<Button type="button" variant="ghost" size="icon-sm" className="absolute right-3 top-3" aria-label={t('Close')} />}><X className="size-4" /></Popover.Close>
        {content}
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>
}
