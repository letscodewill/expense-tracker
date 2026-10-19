import { LegalDocument } from '@/components/legal-document'
import { getServerTranslation } from '@/lib/i18n/server'
import { legalContent } from '@/lib/legal-content'

export async function generateMetadata() {
  const { language } = await getServerTranslation()
  return { title: `${legalContent[language].terms} | NoControle` }
}

export default function TermsOfServicePage() {
  return <LegalDocument kind="terms" />
}
