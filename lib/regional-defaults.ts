import type { Language } from './i18n'
import type { DisplayCurrency } from './currency'

// EU euro-area membership verified November 2026, including Bulgaria.
const euroArea = new Set(['AT','BE','BG','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES'])
export function normalizeCountry(value: unknown): string | null {
  if(typeof value!=='string') return null
  const code=value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code)&&!['XX','ZZ'].includes(code)?code:null
}
export function currencyForLanguage(language: Language,country: string | null): DisplayCurrency {
  if(country&&euroArea.has(country)) return 'EUR'
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
  const language: Language=country==='BR'||country==='PT'?'pt-BR':'en'
  const currency: DisplayCurrency=country==='BR'?'BRL':country&&euroArea.has(country)?'EUR':'USD'
  return {country,language,currency}
}
