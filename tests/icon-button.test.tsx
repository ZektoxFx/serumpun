import { renderToStaticMarkup } from 'react-dom/server';
import { IconButton, iconButtonClasses } from '@/components/ui/IconButton';

// The class list of the first element in the markup.
const classesOf = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? '').split(/\s+/);

// The global focus ring is red (#D51A21 light, #FF7A7F dark). The brand gradient is the same in both
// themes, and a red ring on it is only 1.0 to 2.7:1 (invisible at the red end). Navy is 3.25:1 or better
// along the whole gradient.
it('draws a navy focus ring on the overlay tone, because the global red one vanishes on the gradient', () => {
  const overlay = classesOf(renderToStaticMarkup(<IconButton label="Back" tone="overlay">←</IconButton>));
  expect(overlay).toContain('focus-visible:outline-[#001C3C]');
});

// A white glyph on the gradient is ~2:1 at the amber end; navy on a solid white circle is 16:1 in both themes.
it('is a solid white circle with a navy glyph on the overlay tone', () => {
  const overlay = classesOf(renderToStaticMarkup(<IconButton label="Back" tone="overlay">←</IconButton>));
  expect(overlay).toContain('bg-white');
  expect(overlay).toContain('text-[#001C3C]');
  expect(overlay).not.toContain('text-white');
});

it('leaves the default tone on the global, theme-aware focus ring', () => {
  const plain = classesOf(renderToStaticMarkup(<IconButton label="Close">×</IconButton>));
  expect(plain.some((c) => c.startsWith('focus-visible:outline'))).toBe(false);
});

it('hands the same look to a link through iconButtonClasses', () => {
  const link = classesOf(renderToStaticMarkup(<a className={iconButtonClasses('overlay')}>x</a>));
  expect(link).toContain('size-11');
  expect(link).toContain('bg-white');
  expect(link).toContain('focus-visible:outline-[#001C3C]');
});
