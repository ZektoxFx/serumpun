import { renderToStaticMarkup } from 'react-dom/server';
import { moveChoice, Segmented } from '@/components/ui/Segmented';

// Beyond the brief: the keys of a Segmented with options that cannot be chosen (the invite sheet's roles).
const options = [{}, { disabled: true }, {}, { disabled: true }]; // only the first and third can be chosen

it('moves among the options that can be chosen, skipping the disabled ones, and wraps round', () => {
  expect(moveChoice(options, 0, 'ArrowRight')).toBe(2);
  expect(moveChoice(options, 2, 'ArrowDown')).toBe(0);
  expect(moveChoice(options, 0, 'ArrowLeft')).toBe(2);
  expect(moveChoice(options, 2, 'ArrowUp')).toBe(0);
});
it('takes Home and End to the first and last option that can be chosen', () => {
  expect(moveChoice(options, 2, 'Home')).toBe(0);
  expect(moveChoice(options, 0, 'End')).toBe(2);
});
it('stays put when it is the only option that can be chosen, and ignores any other key', () => {
  expect(moveChoice([{}, { disabled: true }], 0, 'ArrowRight')).toBe(0);
  expect(moveChoice(options, 0, 'a')).toBeNull();
  expect(moveChoice(options, 0, 'Tab')).toBeNull();
  expect(moveChoice([{ disabled: true }], 0, 'ArrowRight')).toBeNull();
});
it('moves through plain options as before', () => {
  expect(moveChoice([{}, {}, {}], 2, 'ArrowRight')).toBe(0);
  expect(moveChoice([{}, {}, {}], 0, 'ArrowLeft')).toBe(2);
});

it('keeps the one tab stop on an option that can be chosen, also when the value is a disabled one or matches none', () => {
  const tabStops = (value: string) =>
    [...renderToStaticMarkup(
      <Segmented
        value={value}
        onChange={() => {}}
        label="Role"
        options={[{ value: 'a', label: 'A', disabled: true }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]}
      />,
    ).matchAll(/tabindex="(-?\d)"/g)].map((match) => match[1]);
  expect(tabStops('c')).toEqual(['-1', '-1', '0']);
  expect(tabStops('a')).toEqual(['-1', '0', '-1']);
  expect(tabStops('zz')).toEqual(['-1', '0', '-1']);
});
