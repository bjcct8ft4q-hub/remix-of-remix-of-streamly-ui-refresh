/** Seasonal themes repeat every year using the visitor's local date. */
export function isHalloweenSeason(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return month === 9 && day >= 5 && day <= 31;
}

/** Christmas runs from 10 November through 31 December, inclusive. */
export function isChristmasSeason(date: Date): boolean {
  const month = date.getMonth();
  return (month === 10 && date.getDate() >= 10) || month === 11;
}
