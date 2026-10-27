// "Add a Co-owner?" on Me: what it shows before the browser has been asked, and how long Later puts it off.
import { renderToStaticMarkup } from 'react-dom/server';
import { CoOwnerPrompt, isPutOff, laterUntil } from '@/components/card/CoOwnerPrompt';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-27T04:00:00Z');

it('renders nothing until the browser has been asked what was saved, so a prompt put off never flashes on a reload', () => {
  // The server has no localStorage to read, and the first client render must match what the server sent.
  expect(renderToStaticMarkup(<CoOwnerPrompt />)).toBe('');
});
it('puts the prompt off for 3 days when someone taps Later', () => {
  const saved = laterUntil(now);
  expect(Date.parse(saved) - now).toBe(3 * DAY);
  expect(isPutOff(saved, now)).toBe(true);
  expect(isPutOff(saved, now + 3 * DAY - 1)).toBe(true);
  expect(isPutOff(saved, now + 3 * DAY)).toBe(false); // asks again on the fourth day
});
it('asks again when nothing was saved, or what was saved cannot be read, or its time has passed', () => {
  for (const saved of [null, '', 'later', 'Invalid Date', new Date(now - 1).toISOString()]) {
    expect(isPutOff(saved, now), String(saved)).toBe(false);
  }
});
