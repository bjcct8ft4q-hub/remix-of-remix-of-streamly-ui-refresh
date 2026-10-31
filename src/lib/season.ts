export function isHalloweenSeason(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return (month === 9 && day >= 5) || (month === 10 && day === 1);
}
/** Christmas is active from 10 November through 31 December 2026 (local date). */
export function isChristmasSeason(date: Date): boolean {
  return date.getFullYear() === 2026 && (date.getMonth() === 11 || (date.getMonth() === 10 && date.getDate() >= 10));
}
