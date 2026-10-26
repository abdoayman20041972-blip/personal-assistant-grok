import { normalize, tokens } from './matcher';

// هل التطبيق يطابق ما كتبه المستخدم في خانة البحث؟
export function matchesSearch(app, search) {
  const q = tokens(search);
  if (!q.length) return true;
  const hay = [app.name, ...(app.aliases || [])].map(normalize);
  return q.every((t) => hay.some((h) => h.includes(t)));
}
