/** Me › Text size: the page's root font size, so everything sized in rem (nearly all text and spacing) grows with it. */
export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_SCALE: Record<TextSize, string> = { sm: '87.5%', md: '100%', lg: '112.5%', xl: '125%' };

// The cookie arrives from the browser.
export const isTextSize = (value: unknown): value is TextSize => TEXT_SIZES.includes(value as TextSize);
