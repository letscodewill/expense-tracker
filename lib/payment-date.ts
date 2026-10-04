/** Fifth Monday–Friday of a zero-based month; holidays are not deducted. */
export function fifthBusinessDayISO(year: number, month: number): string {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 0 || month > 11) {
    throw new RangeError('Mês ou ano de pagamento inválido.')
  }

  const date = new Date(0)
  date.setUTCFullYear(year, month, 1)
  let businessDays = 0
  while (businessDays < 5) {
    const weekday = date.getUTCDay()
    if (weekday !== 0 && weekday !== 6) businessDays++
    if (businessDays < 5) date.setUTCDate(date.getUTCDate() + 1)
  }
  return date.toISOString().slice(0, 10)
}
