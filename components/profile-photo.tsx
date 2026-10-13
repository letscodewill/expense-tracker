'use client'

import { useLanguage } from '@/components/language-provider'
import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveProfilePhoto, validateAvatar } from '@/lib/profile-photo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export function ProfilePhoto({ name, photo, custom, hasGooglePhoto }: { name: string; photo: string | null; custom: boolean; hasGooglePhoto: boolean }) {
  const { t } = useLanguage()

  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase() || '?'

  async function save(reset: boolean) {
    if (!reset && !file) { setError("Escolha uma imagem para enviar."); return }
    setBusy(true)
    setError('')
    try {
      const result = await saveProfilePhoto(createClient(), reset ? null : file)
      if (result.error) { setError(result.error); return }
      setFile(null)
      setOpen(false)
      router.refresh()
    } catch { setError("Não foi possível alterar a foto. Tente novamente.") }
    finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); setFile(null); setError('') } }}>
    <DialogTrigger render={<button type="button" aria-label={t("Alterar foto de perfil")} title={t("Alterar foto de perfil")} className="flex size-11 sm:size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary ring-1 ring-border transition-shadow hover:ring-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />}>
      {photo && failedPhoto !== photo ? <Image src={photo} alt={t("Foto de {name}", { name })} width={44} height={44} unoptimized referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setFailedPhoto(photo)} /> : <span>{initials}</span>}
    </DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{t("Foto de perfil")}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{t("Escolha uma imagem JPG, PNG ou WebP de até 2 MB. Ela aparecerá ao lado do seu nome.")}</p>
      <label htmlFor="profile-photo-file" className="text-sm font-medium">{t("Nova foto")}</label>
      <Input id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
        const selected = event.target.files?.[0] ?? null
        const validation = selected ? validateAvatar(selected) : null
        setError(validation ?? '')
        setFile(validation ? null : selected)
      }} />
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {custom && <Button variant="outline" disabled={busy} onClick={() => void save(true)}>{hasGooglePhoto ? t("Usar foto do Google") : t("Remover foto")}</Button>}
        <Button disabled={busy || !file} onClick={() => void save(false)}>{busy ? t("Salvando...") : t("Salvar foto")}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
