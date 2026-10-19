import Link from 'next/link'
import { getServerTranslation } from '@/lib/i18n/server'
import { legalContent } from '@/lib/legal-content'

export async function LegalDocument({ kind }: { kind: 'privacy' | 'terms' }) {
  const { language } = await getServerTranslation()
  const content = legalContent[language]
  const document = content.documents[kind]
  // Only a deliberately configured public support address is published.
  const supportEmail = process.env.NOCONTROLE_SUPPORT_EMAIL?.trim() || 'suportenocontroleofc@gmail.com'
  const validEmail = supportEmail && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(supportEmail)
  const ticketsLabel = language === 'en' ? 'My tickets' : language === 'es' ? 'Mis solicitudes' : 'Meus tickets'

  return <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link href="/login" className="text-xl font-semibold text-primary">NoControle</Link>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">{content.back}</Link>
      </header>
      <article className="space-y-8 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-10">
        <header className="space-y-3">
          <p className="text-sm text-muted-foreground">{content.updated}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{document.title}</h1>
          <p className="leading-relaxed text-muted-foreground">{document.intro}</p>
        </header>
        {document.sections.map(section => <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.paragraphs.map(paragraph => <p key={paragraph} className="break-words text-sm leading-7 sm:text-base">{paragraph}</p>)}
        </section>)}
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">{content.contact}</h2>
          <p className="text-sm leading-7 sm:text-base">{content.contactText}</p>
          {validEmail && <p><a href={`mailto:${supportEmail}`} className="break-all text-primary underline underline-offset-4">{supportEmail}</a></p>}
          <Link href="/tickets" className="inline-block text-primary underline underline-offset-4">{ticketsLabel}</Link>
        </section>
      </article>
      <nav aria-label={language === 'en' ? 'Legal documents' : language === 'es' ? 'Documentos legales' : 'Documentos legais'} className="mt-6 flex flex-wrap gap-5 text-sm text-primary">
        <Link href="/privacypolicy" className="hover:underline">{content.privacy}</Link>
        <Link href="/termsofservice" className="hover:underline">{content.terms}</Link>
      </nav>
    </div>
  </main>
}
