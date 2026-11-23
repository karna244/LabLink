export function formatHour12(hour24: number): string {
  const h = ((Math.floor(hour24) % 24) + 24) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${suffix}`;
}

export function formatHour12Short(hour24: number): string {
  const h = ((Math.floor(hour24) % 24) + 24) % 24;
  const suffix = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${suffix}`;
}

export function formatRange12(startHour24: number, endHour24: number): string {
  return `${formatHour12(startHour24)} – ${formatHour12(endHour24)}`;
}

export function daysUntilDate(targetDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = targetDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
