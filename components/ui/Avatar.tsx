const tints = [
  'bg-tint-blue text-text',
  'bg-tint-orange text-orange-text',
  'bg-tint-purple text-purple-text',
  'bg-tint-green text-green-text',
  'bg-tint-amber text-amber-text',
];

const firstLetter = (word: string) => Array.from(word)[0] ?? '';

/** "Aisyah Rahman" -> "AR", "Madonna" -> "M", "" -> "?". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const last = words.length > 1 ? firstLetter(words[words.length - 1]) : '';
  return (firstLetter(words[0]) + last).toUpperCase();
}

// Same name, same colour, on server and client.
const tintFor = (name: string) =>
  tints[Math.abs(Array.from(name).reduce((hash, ch) => (hash * 31 + (ch.codePointAt(0) ?? 0)) | 0, 0)) % tints.length];

/** Initials in a coloured circle. Decorative: the person's name is always shown next to it. */
export function Avatar({ name, size = 40, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-extrabold ${tintFor(name)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
