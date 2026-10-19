import { LegalDocument } from '@/components/legal-document'
import { getServerTranslation } from '@/lib/i18n/server'
import { legalContent } from '@/lib/legal-content'

export async function generateMetadata() {
  const { language } = await getServerTranslation()
  return { title: `${legalContent[language].privacy} | NoControle` }
}

export default function PrivacyPolicyPage() {
  return <LegalDocument kind="privacy" />
}
