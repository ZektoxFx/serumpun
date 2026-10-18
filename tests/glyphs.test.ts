import { existsSync } from 'node:fs';
import path from 'node:path';
import { ALERT_ICON } from '@/lib/domain/alerts';
import { SPORT_ICON } from '@/lib/domain/booking';
import { GROUP_ICON, SERVICE_ICON } from '@/lib/domain/community';
import { EVENT_ICON } from '@/lib/domain/events';
import { GLYPH, glyphFor } from '@/lib/domain/glyphs';
import { CONTEXT_ICON } from '@/lib/domain/messages';
import { CREATE_ACTIONS, HELP_LINKS, ME_LINKS, SERVICES } from '@/lib/domain/nav';
import { NOTICE_ICON } from '@/lib/domain/notices';
import { REWARD_CATEGORY_ICON } from '@/lib/domain/points';
import { CATEGORY_ICON } from '@/lib/domain/reports';

describe("the team's line icons", () => {
  it('has a file in public/icons/line for every emoji it draws', () => {
    for (const [emoji, name] of Object.entries(GLYPH)) {
      expect(existsSync(path.join('public', 'icons', 'line', `${name}.png`)), `${emoji} → ${name}`).toBe(true);
    }
  });

  it('draws every Home and More service, the Create sheet, the Me lists and every map alert', () => {
    const shown = [...SERVICES, ...CREATE_ACTIONS, ...ME_LINKS, ...HELP_LINKS].map((s) => s.icon);
    for (const emoji of [...shown, ...Object.values(ALERT_ICON)]) expect(glyphFor(emoji), emoji).toBeDefined();
  });

  it('draws every category of a set, so a row of them is one style', () => {
    const sets = { SPORT_ICON, GROUP_ICON, SERVICE_ICON, EVENT_ICON, CONTEXT_ICON, NOTICE_ICON, REWARD_CATEGORY_ICON, CATEGORY_ICON };
    for (const [set, icons] of Object.entries(sets)) {
      for (const [key, emoji] of Object.entries(icons)) expect(glyphFor(emoji), `${set}.${key}`).toBeDefined();
    }
  });

  it('leaves an emoji the team drew nothing for as it is', () => {
    expect(glyphFor('🚻')).toBeUndefined();
    expect(glyphFor('__proto__')).toBeUndefined();
  });
});
