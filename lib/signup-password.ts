export const SIGNUP_PASSWORD_HINT = 'Use pelo menos 12 caracteres, incluindo letra maiúscula, letra minúscula, número e símbolo.'

/** New registrations only; never trim or otherwise transform a password. */
export function isStrongSignupPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
    && new RegExp('\\p{Lu}', 'u').test(value)
    && new RegExp('\\p{Ll}', 'u').test(value)
    && new RegExp('\\p{N}', 'u').test(value)
    && new RegExp('[\\p{P}\\p{S}]', 'u').test(value)
}
