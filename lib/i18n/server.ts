import { cookies, headers } from 'next/headers'
import { LANGUAGE_COOKIE, LANGUAGE_MANUAL_COOKIE, normalizeLanguage, translate, languageLocale } from './index'
import { CURRENCY_COOKIE, CURRENCY_MANUAL_COOKIE, normalizeCurrency, isDisplayCurrency } from '../currency'
import { regionalDefaults } from '../regional-defaults'

export async function getServerTranslation() {
  const jar=await cookies(), requestHeaders=await headers()
  const regional=regionalDefaults(requestHeaders.get('x-vercel-ip-country'),requestHeaders.get('accept-language'))
  const saved = jar.get(LANGUAGE_COOKIE)?.value
  const language = jar.get(LANGUAGE_MANUAL_COOKIE)?.value==='1' && (saved === 'pt-BR' || saved === 'en' || saved === 'es')
    ? normalizeLanguage(saved)
    : regional.language
  const savedCurrency=jar.get(CURRENCY_COOKIE)?.value
  const currency=jar.get(CURRENCY_MANUAL_COOKIE)?.value==='1' && isDisplayCurrency(savedCurrency) ? normalizeCurrency(savedCurrency) : regional.currency
  return { locale: languageLocale(language), t: (text: string) => translate(text, language), language, currency, country:regional.country }
}
