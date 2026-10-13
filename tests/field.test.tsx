import { renderToStaticMarkup } from 'react-dom/server';
import { Field } from '@/components/ui/Field';

// First value of `name="..."` on the first <tag ...> in the markup.
const attr = (html: string, tag: string, name: string) => new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`).exec(html)?.[1];

it('ties the label, hint and error to the control for screen readers', () => {
  const html = renderToStaticMarkup(
    <Field label="Email" hint="We never show it" error="Enter an email">
      {(control) => <input {...control} type="email" />}
    </Field>,
  );
  const id = attr(html, 'input', 'id');
  expect(id).toBeTruthy();
  expect(attr(html, 'label', 'for')).toBe(id);
  expect(attr(html, 'input', 'aria-describedby')).toBe(`${id}-hint ${id}-error`);
  expect(html).toContain(`id="${id}-hint"`);
  expect(html).toContain(`id="${id}-error"`);
  expect(attr(html, 'input', 'aria-invalid')).toBe('true');
});

it('adds no hint or error wiring when there is neither', () => {
  const html = renderToStaticMarkup(<Field label="Name">{(control) => <input {...control} />}</Field>);
  expect(attr(html, 'input', 'aria-describedby')).toBeUndefined();
  expect(attr(html, 'input', 'aria-invalid')).toBeUndefined();
});
