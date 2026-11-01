/** Decorative brand illustration: no client-side script or interaction layer. */
export function LoginBrandBackground() {
  return <div aria-hidden="true" className="login-brand-background pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div className="login-brand-glow login-brand-glow-primary" />
    <div className="login-brand-glow login-brand-glow-secondary" />
    <div className="login-brand-grid" />
    <div className="login-brand-orbit login-brand-orbit-outer" />
    <div className="login-brand-orbit login-brand-orbit-inner" />
    <svg className="login-brand-watermark" viewBox="0 0 400 400" fill="none" focusable="false">
      <rect x="64" y="70" width="248" height="282" rx="40" stroke="currentColor" strokeWidth="12" />
      <path d="M122 45V100M188 45V100M254 45V100" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
      <text x="106" y="240" fill="currentColor" fontSize="108" fontWeight="750" fontFamily="inherit">R$</text>
      <path d="M108 284H230M108 316H188" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
      <path d="M240 310L317 217Q324 208 333 216L354 234Q362 242 354 251L277 344L232 358Z" fill="var(--background)" stroke="currentColor" strokeWidth="10" strokeLinejoin="round" />
      <path d="M240 310L277 344M308 230L344 261" stroke="currentColor" strokeWidth="9" />
    </svg>
    <span className="login-brand-wordmark">NoControle</span>
    <span className="login-brand-spark login-brand-spark-one" />
    <span className="login-brand-spark login-brand-spark-two" />
    <span className="login-brand-spark login-brand-spark-three" />
  </div>
}
