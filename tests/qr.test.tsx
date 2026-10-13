import { QR } from '@/components/ui/QR';

it('renders a dark-on-white SVG that does not depend on the theme', async () => {
  const el = await QR({ value: 'https://serumpun.example/checkin/1?c=abc', label: 'Check-in QR' });
  const svg: string = el.props.dangerouslySetInnerHTML.__html;
  expect(svg).toMatch(/^<svg /);
  expect(svg).toContain('viewBox');
  expect(svg).toContain('fill="#ffffff"'); // light background baked into the image
  expect(svg).toContain('stroke="#000000"'); // dark modules baked into the image
  expect(el.props['aria-label']).toBe('Check-in QR');
});

it('encodes different values differently', async () => {
  const html = async (value: string) => (await QR({ value, label: 'x' })).props.dangerouslySetInnerHTML.__html;
  expect(await html('ELM-AB12-CD')).not.toBe(await html('ELM-AB12-CE'));
});
