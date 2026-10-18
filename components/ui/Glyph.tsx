import { glyphFor } from '@/lib/domain/glyphs';

/**
 * One of the team's line icons (public/icons/line/`name`.png), drawn in the text's colour (a mask) so it follows dark
 * mode, the active tab's red and the like. Decorative: whatever it stands for is written next to it or names its button.
 */
export function Icon({ name, className = 'size-6' }: { name: string; className?: string }) {
  const mask = `url(/icons/line/${name}.png) center / contain no-repeat`;
  return <span aria-hidden="true" className={`inline-block shrink-0 bg-current ${className}`} style={{ mask, WebkitMask: mask }} />;
}

/** An emoji as the team's icon when they drew one (else the emoji itself), sized like the text around it. */
export function Glyph({ emoji, className = '' }: { emoji: string; className?: string }) {
  const name = glyphFor(emoji);
  if (!name) {
    return (
      <span aria-hidden="true" className={className}>
        {emoji}
      </span>
    );
  }
  return <Icon name={name} className={`size-[1.15em] align-[-0.2em] ${className}`} />;
}
