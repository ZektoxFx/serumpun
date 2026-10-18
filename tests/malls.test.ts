import { MALLS, findMall, rateText } from '@/lib/domain/malls';

describe('Sime Darby Property malls', () => {
  it('lists the two SDP malls', () => {
    expect(MALLS.map((m) => m.slug)).toEqual(['elmina-lakeside-mall', 'kl-east-mall']);
  });

  it('marks the Elmina rate as a sample and KL East as real with service tax', () => {
    expect(findMall('elmina-lakeside-mall')!.rate).toEqual({ firstHours: 2, firstSen: 200, nextHourSen: 100, taxRate: 0, sample: true });
    expect(findMall('kl-east-mall')!.rate).toEqual({ firstHours: 2, firstSen: 200, nextHourSen: 200, taxRate: 0.08, sample: false });
  });

  it('gives 20 minutes to exit everywhere, and only Elmina has a directory', () => {
    expect(MALLS.every((m) => m.graceMinutes === 20)).toBe(true);
    expect(MALLS.filter((m) => m.directory).map((m) => m.slug)).toEqual(['elmina-lakeside-mall']);
    expect(findMall('nope')).toBeNull();
    expect(findMall(undefined)).toBeNull();
  });

  it('says the rate in words, with the service tax when there is one', () => {
    expect(rateText(findMall('elmina-lakeside-mall')!.rate, 'en')).toBe('RM2.00 first 2 hours, then RM1.00 an hour');
    expect(rateText(findMall('kl-east-mall')!.rate, 'en')).toBe('RM2.00 first 2 hours, then RM2.00 an hour, plus 8% service tax');
    expect(rateText(findMall('kl-east-mall')!.rate, 'ms')).toBe('RM2.00 2 jam pertama, kemudian RM2.00 sejam, tambah cukai perkhidmatan 8%');
  });
});
