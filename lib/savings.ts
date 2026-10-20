export const MAX_SAVINGS_CENTS = 99999999999
export type SavingsAccount = { balance_cents: number; goal_cents: number | null }

/** Parse an amount exactly to cents; never silently round extra decimals. */
export function savingsCents(input: string): number | null {
  const value = input.trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split(/[.,]/)
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_SAVINGS_CENTS ? cents : null
}

export function savingsProgress(account: SavingsAccount) {
  const goal = account.goal_cents
  return {
    achieved: goal !== null && goal > 0 && account.balance_cents >= goal,
    percent: goal && goal > 0 ? Math.min(100, Math.max(0, account.balance_cents / goal * 100)) : 0,
    remaining: goal ? Math.max(0, goal - account.balance_cents) : 0,
  }
}
