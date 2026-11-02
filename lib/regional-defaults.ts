import type { Language } from './i18n'
import { currencyForCountry, type DisplayCurrency } from './currency'

// Spanish-speaking Latin America, including Puerto Rico. Spain keeps English/EUR.
const spanishLatinAmerica = new Set(['AR','BO','CL','CO','CR','CU','DO','EC','SV','GT','HN','MX','NI','PA','PY','PE','PR','UY','VE'])
export function normalizeCountry(value: unknown): string | null {
  if(typeof value!=='string') return null
  const code=value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code)&&!['XX','ZZ'].includes(code)?code:null
}
export function currencyForLanguage(language: Language,country: string | null): DisplayCurrency {
  if(country) return currencyForCountry(country)
  return language==='pt-BR'?'BRL':'USD'
}
export function regionalDefaults(value: unknown,acceptLanguage: string | null) {
  let country=normalizeCountry(value)
  // Browser locale is a fallback hint when the hosting country is unavailable,
  // e.g. localhost. It is not treated as precise geolocation.
  if(!country){
    const locales=(acceptLanguage??'').split(',').map((raw,index)=>{
      const [tag,...params]=raw.trim().split(';'), quality=params.find(p=>p.trim().startsWith('q='))?.split('=')[1]
      return {tag,quality:quality===undefined?1:Number(quality),index}
    }).filter(x=>Number.isFinite(x.quality)&&x.quality>0&&x.quality<=1).sort((a,b)=>b.quality-a.quality||a.index-b.index)
    const match=locales[0]?.tag.match(/^[a-z]{2,3}(?:-[a-z]{4})?-([a-z]{2})$/i)
    country=normalizeCountry(match?.[1])
  }
  const language: Language=country==='BR'||country==='PT'?'pt-BR':country&&spanishLatinAmerica.has(country)?'es':'en'
  const currency: DisplayCurrency=currencyForCountry(country)
  return {country,language,currency}
}
