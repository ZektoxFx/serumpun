import { firstName, statusKey } from '@/lib/domain/profile';

describe('statusKey', () => {
  it('says what the account is: verified resident, waiting for approval, or Management Office', () => {
    expect(statusKey({ role: 'resident', status: 'verified' })).toBe('home.status.verified');
    expect(statusKey({ role: 'resident', status: 'pending' })).toBe('home.status.pending');
    expect(statusKey({ role: 'management', status: 'verified' })).toBe('role.management');
  });
});

describe('firstName', () => {
  it('takes the first word of a full name', () => {
    expect(firstName('Aisyah Rahman')).toBe('Aisyah');
    expect(firstName('Muhammad Nur Aqilah binti Abdul Rahman')).toBe('Muhammad');
  });

  it('ignores stray spaces', () => {
    expect(firstName('  Nur   Iman ')).toBe('Nur');
  });

  it('copes with a single name and with nothing', () => {
    expect(firstName('Madonna')).toBe('Madonna');
    expect(firstName('')).toBe('');
    expect(firstName('   ')).toBe('');
  });
});
