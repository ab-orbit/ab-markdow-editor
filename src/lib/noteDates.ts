import { t, currentLocale } from '../i18n';
/** Local-calendar groups keep yesterday stable across daylight-saving changes. */
export function noteGroup(iso: string, now = Date.now()): string {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today); week.setDate(week.getDate() - 7);
  const stamp = Date.parse(iso);
  return t(stamp >= +today ? 'Hoje' : stamp >= +yesterday ? 'Ontem' : stamp >= +week ? t("Últimos 7 dias") : t("Mais antigas"));
}
/** Short metadata stays useful without repeating full timestamps on every row. */
export function shortNoteDate(iso: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < 60000) return t('agora');
  const relative = new Intl.RelativeTimeFormat(currentLocale(), {style:'short', numeric:'always'});
  if (elapsed < 3600000) return relative.format(-Math.floor(elapsed / 60000), 'minute');
  if (elapsed < 86400000) return relative.format(-Math.floor(elapsed / 3600000), 'hour');
  if (noteGroup(iso, now) === t('Ontem')) return t('ontem');
  if (elapsed < 7 * 86400000) return relative.format(-Math.floor(elapsed / 86400000), 'day');
  const date = new Date(iso);
  const month = date.toLocaleDateString(currentLocale(), {month:'short'}).replace('.', '');
  return `${date.getDate()} ${month}${date.getFullYear() !== new Date(now).getFullYear() ? ` ${date.getFullYear()}` : ''}`;
}
