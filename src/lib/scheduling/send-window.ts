export function isWithinSendWindow(
  date: Date,
  windowStart: string | null,
  windowEnd: string | null,
  timezone: string
): boolean {
  if (!windowStart || !windowEnd) return true;

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(date);
  const hStr = parts.find(p => p.type === 'hour')?.value ?? '00';
  const mStr = parts.find(p => p.type === 'minute')?.value ?? '00';

  const hNum = parseInt(hStr, 10);
  const hhmm = `${(hNum === 24 ? 0 : hNum).toString().padStart(2, '0')}:${mStr.padStart(2, '0')}`;

  if (windowStart <= windowEnd) {
    return hhmm >= windowStart && hhmm <= windowEnd;
  } else {
    return hhmm >= windowStart || hhmm <= windowEnd;
  }
}

export function getNextAllowedSendTime(
  desiredDate: Date,
  windowStart: string | null,
  windowEnd: string | null,
  timezone: string
): Date {
  if (!windowStart || !windowEnd) return desiredDate;

  if (isWithinSendWindow(desiredDate, windowStart, windowEnd, timezone)) {
    return desiredDate;
  }

  const candidate = new Date(desiredDate.getTime());
  candidate.setSeconds(0, 0);

  for (let i = 0; i <= 1441; i++) {
    candidate.setMinutes(candidate.getMinutes() + 1);
    
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = fmt.formatToParts(candidate);
    const hStr = parts.find(p => p.type === 'hour')?.value ?? '00';
    const mStr = parts.find(p => p.type === 'minute')?.value ?? '00';
    
    const hNum = parseInt(hStr, 10);
    const hhmm = `${(hNum === 24 ? 0 : hNum).toString().padStart(2, '0')}:${mStr.padStart(2, '0')}`;
    
    if (hhmm === windowStart) {
      return candidate;
    }
  }

  return desiredDate;
}
