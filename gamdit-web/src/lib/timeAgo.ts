// src/lib/timeAgo.ts
export function timeAgo(input: string | number | Date): string {
    const d = new Date(input);
    const s = (Date.now() - d.getTime()) / 1000;
  
    const unit = (n: number, u: Intl.RelativeTimeFormatUnit) =>
      new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
        -Math.round(n),
        u
      );
  
    if (s < 60) return unit(s, 'second');
    const m = s / 60;
    if (m < 60) return unit(m, 'minute');
    const h = m / 60;
    if (h < 24) return unit(h, 'hour');
    const d2 = h / 24;
    if (d2 < 7) return unit(d2, 'day');
    const w = d2 / 7;
    if (w < 5) return unit(w, 'week');
    const mo = d2 / 30;
    if (mo < 12) return unit(mo, 'month');
    return unit(d2 / 365, 'year');
  }