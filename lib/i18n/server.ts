import { cookies, headers } from 'next/headers'
import { LANGUAGE_COOKIE, normalizeLanguage, detectLanguage, translate, languageLocale } from './index'

export async function getServerTranslation() {
  const saved = (await cookies()).get(LANGUAGE_COOKIE)?.value
  const language = saved === 'pt-BR' || saved === 'en' || saved === 'es'
    ? normalizeLanguage(saved)
    : detectLanguage((await headers()).get('accept-language'))
  return { locale: languageLocale(language), t: (text: string) => translate(text, language), language }
}
