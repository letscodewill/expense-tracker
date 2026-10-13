import { cookies } from 'next/headers'
import { LANGUAGE_COOKIE, normalizeLanguage, translate } from './index'

export async function getServerTranslation() {
  const language = normalizeLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value)
  return { locale: language === 'en' ? 'en-US' : 'pt-BR', t: (text: string) => translate(text, language), language }
}
