const CYRILLIC_MAP: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e',
  'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k',
  'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
  'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya',
};

export function toSlug(text: string, maxLen = 60): string {
  const lower = text.toLowerCase();
  let latin = '';
  for (const char of lower) {
    latin += CYRILLIC_MAP[char] ?? char;
  }
  return latin
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/, '');
}

export function buildFilename(text: string, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Shift to Moscow time (UTC+3)
  const moscow = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const yyyy = moscow.getUTCFullYear();
  const mm = pad(moscow.getUTCMonth() + 1);
  const dd = pad(moscow.getUTCDate());
  const HH = pad(moscow.getUTCHours());
  const MM = pad(moscow.getUTCMinutes());
  const slug = toSlug(text);
  return `Inbox/${yyyy}-${mm}-${dd}_${HH}${MM}_${slug}.md`;
}
