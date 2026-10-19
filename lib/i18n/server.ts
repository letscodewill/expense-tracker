import { cookies } from 'next/headers'
import { LANGUAGE_COOKIE, normalizeLanguage, translate, languageLocale } from './index'

export async function getServerTranslation() {
  const language = normalizeLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value)
  return { locale: languageLocale(language), t: (text: string) => translate(text, language), language }
}
