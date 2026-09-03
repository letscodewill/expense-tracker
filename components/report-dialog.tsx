'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import { Flag } from 'lucide-react'

export function ReportDialog() {
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [subject, setSubject] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [protocol, setProtocol] = useState<number | null>(null)


    function reset() {
        setSubject('')
        setMessage('')
        setError('')
        setProtocol(null)
    }

    async function handleSubmit() {
        if (!subject.trim() || !message.trim()) {
            setError('Preencha assunto e descrição.')
            return
        }

        setLoading(true)
        setError('')

        const { data: { user } } = await supabase.auth.getUser()

        const { data, error: insertError } = await supabase
            .from('reports')
            .insert({
                subject: subject.trim(),
                message: message.trim(),
                user_id: user?.id,
                user_email: user?.email,
                user_name: user?.user_metadata?.full_name || null,
            })
            .select('protocol_number')
            .single()

        setLoading(false)

        if (insertError || !data) {
            console.error('Erro ao enviar report:', insertError)
            setError('Não foi possível enviar. Tente novamente.')
            return
        }

        setProtocol(data.protocol_number)
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen)
                if (!isOpen) reset()
            }}
        >
            <DialogTrigger
                render={
                    <Button variant="outline" size="sm">
                        <Flag className="h-4 w-4 mr-1" />
                        Reportar problema
                    </Button>
                }
            />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reportar um problema</DialogTitle>
                </DialogHeader>

                {protocol !== null ? (
                    <div className="space-y-4 py-4 text-center">
                        <p className="text-sm">Seu ticket foi registrado com sucesso.</p>
                        <p className="text-2xl font-bold">Protocolo #{protocol}</p>
                        <p className="text-sm text-muted-foreground">
                            Guarde esse número caso precise fazer referência a este problema depois.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="report-subject">Assunto</Label>
                            <Input
                                id="report-subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ex: Erro ao salvar despesa"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="report-message">Descreva o problema</Label>
                            <Textarea
                                id="report-message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Conte o que aconteceu, com o máximo de detalhes possível..."
                                rows={5}
                            />
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                )}

                <DialogFooter>
                    {protocol !== null ? (
                        <Button onClick={() => setOpen(false)} className="w-full">
                            Fechar
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading} className="w-full">
                            {loading ? 'Enviando...' : 'Enviar ticket'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}