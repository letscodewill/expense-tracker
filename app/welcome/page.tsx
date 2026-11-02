import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, ScanLine, ListChecks, ChartNoAxesCombined, ShieldCheck } from 'lucide-react'
import { getServerTranslation } from '@/lib/i18n/server'
import { LoginBrandBackground } from '@/components/login-brand-background'
import { LandingHero } from '@/components/landing-hero'
import { BILLING_OFFERS } from '@/lib/billing-offers'

export async function generateMetadata(): Promise<Metadata> {
  const {t}=await getServerTranslation()
  return {title:t('NoControle — Menos digitação, mais controle'),description:t('Organize suas despesas com fotos, faturas e planilhas. Acompanhe parcelas, orçamento e metas. Comece grátis.'),alternates:{canonical:'https://nocontrole.slimastore.com.br/welcome'},openGraph:{title:t('NoControle — Menos digitação, mais controle'),description:t('Organize suas despesas com fotos, faturas e planilhas. Acompanhe parcelas, orçamento e metas. Comece grátis.'),url:'https://nocontrole.slimastore.com.br/welcome',type:'website'}}
}

export default async function WelcomePage(){
  const {t,country,locale}=await getServerTranslation()
  const offer=BILLING_OFFERS[country==='BR'?'brl_month':'usd_month']
  const price=new Intl.NumberFormat(locale,{style:'currency',currency:offer.currency.toUpperCase(),currencyDisplay:'code'}).format(offer.amount/100)
  const steps=[
    {Icon:ScanLine,title:'Do comprovante ao painel',body:'Envie uma foto, PDF ou planilha. A leitura com IA ajuda a preparar seus lançamentos.'},
    {Icon:ListChecks,title:'Você confere. Você decide.',body:'Revise valores, categorias, parcelas e o mês de pagamento antes de salvar.'},
    {Icon:ChartNoAxesCombined,title:'Saiba o que ainda falta pagar',body:'Acompanhe o mês por quadros, veja as pendências e planeje seus próximos passos.'},
  ]
  const questions=[
    ['Preciso conectar meu banco?','Não. Você pode cadastrar despesas manualmente ou importar arquivos. O NoControle não oferece conexão bancária automática.'],
    ['Posso começar sem pagar?','Sim. O Essencial inclui lançamentos manuais, um quadro secundário por mês, uma análise com IA por mês e uma meta no cofrinho. Não é necessário cartão de crédito.'],
    ['A IA salva tudo automaticamente?','Não. Você revisa os dados antes de confirmar. A análise pode cometer erros; confira especialmente valores e parcelas.'],
    ['Funciona no celular?','Sim. Acesse pelo navegador e instale o NoControle na tela inicial quando essa opção estiver disponível.'],
    ['O dólar converte minhas despesas?','Não. A moeda escolhida altera somente a exibição, sem converter os valores. A moeda da assinatura é escolhida separadamente no checkout.'],
    ['Como funciona a assinatura?','O Total tem cobrança recorrente mensal ou anual. Confira os valores e as condições na página de planos antes de assinar.'],
  ]
  return <main className="relative isolate min-h-dvh overflow-x-clip bg-background text-foreground">
    <LoginBrandBackground />
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-border/60 px-5 py-5 sm:px-8">
      <Link href="/welcome" className="flex items-center gap-2 font-semibold"><Image src="/icons/icon-192.png" width={36} height={36} alt="" className="rounded-xl"/>NoControle</Link>
      <nav aria-label={t('Navegação principal')} className="flex flex-wrap items-center gap-4 text-sm"><Link href="/login?mode=email" className="font-medium text-primary">{t('Entrar')}</Link><Link href="/login?mode=signup" className="rounded-full bg-primary px-4 py-2.5 font-medium text-primary-foreground">{t('Começar grátis')}</Link></nav>
    </header>
    <LandingHero />
    <section id="how" aria-labelledby="how-title" className="scroll-mt-6 border-y border-border bg-card/80 px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl"><p className="text-sm font-medium text-primary">{t('Como funciona')}</p><h2 id="how-title" className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{t('Menos trabalho para organizar. Mais espaço para planejar.')}</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">{steps.map(({Icon,title,body},i)=><article key={title}><div className="mb-5 flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"><Icon aria-hidden="true" className="size-6"/></span><span className="text-sm text-muted-foreground">0{i+1}</span></div><h3 className="text-lg font-semibold">{t(title)}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{t(body)}</p></article>)}</div>
      </div>
    </section>
    <section aria-labelledby="benefits-title" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8"><h2 id="benefits-title" className="max-w-2xl text-3xl font-semibold tracking-tight">{t('Não é só registrar. É entender o seu mês.')}</h2><div className="mt-8 grid gap-5 md:grid-cols-3">{[{title:'Saiba o que falta pagar',body:'Veja despesas pagas e pendentes sem perder a visão do total.'},{title:'Organize suas parcelas',body:'Distribua os pagamentos nos meses e mantenha cada despesa no quadro certo.'},{title:'Dê um destino ao que guardar',body:'Defina uma meta no cofrinho e acompanhe seu progresso.'}].map(({title,body})=><article key={title} className="rounded-2xl border border-border bg-card p-6"><Check className="mb-4 size-5 text-primary" aria-hidden="true"/><h3 className="font-semibold">{t(title)}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(body)}</p></article>)}</div></section>
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2">
      <div><p className="text-sm font-medium text-primary">{t('Um plano para o seu dinheiro')}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('As contas do mês e os planos de amanhã, juntos.')}</h2><p className="mt-5 leading-relaxed text-muted-foreground">{t('Separe despesas por quadro, acompanhe suas categorias e reserve dinheiro para uma meta. Uma rotina que cabe no computador e no celular.')}</p></div>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-primary/5 sm:p-8"><ShieldCheck className="mb-5 size-8 text-primary" aria-hidden="true"/><h3 className="text-xl font-semibold">{t('Clareza também nas condições')}</h3><ul className="mt-6 space-y-4">{['Importações com revisão antes de salvar.','Limites de cada plano informados antes da compra.','Exportação CSV disponível no Essencial.','Suporte e políticas acessíveis a qualquer momento.'].map(text=><li key={text} className="flex gap-3 text-sm leading-relaxed"><Check aria-hidden="true" className="size-5 shrink-0 text-primary"/>{t(text)}</li>)}</ul><Link href="/privacypolicy" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-4">{t('Política de privacidade')}</Link></div>
    </section>
    <section id="plans" aria-labelledby="plans-title" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-10 sm:px-8">
      <div className="mb-8 text-center"><h2 id="plans-title" className="text-3xl font-semibold">{t('Comece com o essencial. Evolua no seu ritmo.')}</h2><p className="mt-4 text-muted-foreground">{t('Escolha o plano que combina com a sua rotina.')}</p></div>
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">{[{name:'Essencial',headline:t('Grátis'),items:['Lançamentos manuais sem limite.','1 quadro secundário por mês.','1 análise com IA por mês.','1 meta no cofrinho e exportação CSV.'],href:'/login?mode=signup',cta:'Começar grátis'},{name:'Total',headline:price+' / '+t('mês'),items:['Quadros secundários sem limite.','10 análises com IA por mês.','Múltiplas metas no cofrinho.','Exportação PDF, TXT, CSV e Excel.'],href:'/plans',cta:'Conheça os planos Essencial e Total'}].map(plan=><article key={plan.name} className={`flex flex-col rounded-3xl border bg-card p-7 ${plan.name==='Essencial'?'border-primary shadow-lg shadow-primary/10':'border-border'}`}><h3 className="text-lg font-medium text-primary">NoControle {t(plan.name)}</h3><p className="mt-3 text-3xl font-semibold tracking-tight">{plan.headline}</p><ul className="my-7 space-y-4">{plan.items.map(item=><li key={item} className="flex gap-2 text-sm"><Check className="size-4 shrink-0 text-primary" aria-hidden="true"/>{t(item)}</li>)}</ul><Link href={plan.href} className={`mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-center text-sm font-medium ${plan.name==='Essencial'?'bg-primary text-primary-foreground hover:opacity-90':'border border-border text-primary hover:bg-accent'}`}>{t(plan.cta)}<ArrowRight className="size-4 shrink-0" aria-hidden="true"/></Link></article>)}</div><p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">{t('PDFs, imagens e planilhas compartilham o limite mensal de IA. O Total tem renovação automática e opção anual na página de planos. A cobrança é em BRL ou USD; não há conversão das despesas.')}</p>
    </section>
    <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-5 py-16 sm:px-8"><h2 id="faq-title" className="mb-8 text-center text-3xl font-semibold">{t('Dúvidas antes de começar?')}</h2><div className="divide-y divide-border">{questions.map(([q,a])=><details key={q} className="group py-5"><summary className="cursor-pointer rounded-sm text-base font-medium focus-visible:outline-2 focus-visible:outline-primary">{t(q)}</summary><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t(a)}</p></details>)}</div></section>
    <section className="mx-5 mb-16 rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:mx-auto sm:max-w-5xl"><h2 className="text-3xl font-semibold">{t('Seu próximo mês pode começar mais organizado.')}</h2><p className="mx-auto mt-4 max-w-xl leading-relaxed">{t('Crie sua conta e comece pela primeira despesa. O resto, você organiza no seu ritmo.')}</p><Link href="/login?mode=signup" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-6 py-3 font-medium text-foreground">{t('Começar grátis')}<ArrowRight aria-hidden="true" className="size-4"/></Link><p className="mt-4 text-xs">{t('Comece grátis. Sem cartão de crédito.')}</p></section>
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 border-t border-border px-5 py-8 text-sm text-muted-foreground sm:px-8"><span>NoControle</span><nav className="flex flex-wrap gap-5"><Link href="/privacypolicy">{t('Política de privacidade')}</Link><Link href="/termsofservice">{t('Termos de uso')}</Link><a href="mailto:suportenocontroleofc@gmail.com">{t('Suporte')}</a></nav></footer>
  </main>
}
