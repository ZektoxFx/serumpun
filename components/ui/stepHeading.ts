// The focus a step takes when it replaces the one before, shared by the sign-in and register flows and the invite sheet.

/** A step that replaces the one before takes the focus, so a screen reader starts reading there. Stable, so mount only. */
export const focusOnMount = (heading: HTMLElement | null) => heading?.focus();
export const stepHeading = 'text-xl font-extrabold outline-none';
