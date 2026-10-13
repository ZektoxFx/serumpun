'use client';

// TEMPORARY verification page for Task 1. Deleted before the final commit.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useT } from '@/lib/i18n';
import { Avatar } from '@/components/ui/Avatar';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet, type SheetSide } from '@/components/ui/Sheet';
import { Switch } from '@/components/ui/Switch';
import { Tag } from '@/components/ui/Tag';

const swatches = [
  'bg-bg', 'bg-surface', 'bg-chip', 'bg-soft', 'bg-ink', 'bg-red', 'bg-orange', 'bg-amber', 'bg-sidebar',
  'bg-tint-blue', 'bg-tint-orange', 'bg-tint-red', 'bg-tint-purple', 'bg-tint-green', 'bg-tint-amber',
  'bg-brand-gradient',
];
const texts = [
  'text-text', 'text-muted', 'text-muted-2', 'text-red-text', 'text-green-text', 'text-orange-text',
  'text-purple-text', 'text-amber-text',
];

export function GalleryClient() {
  const { setTheme } = useTheme();
  const router = useRouter();
  const t = useT();
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [sheet, setSheet] = useState<SheetSide | null>(null);

  function setLang(lang: 'en' | 'ms') {
    document.cookie = `lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="grid gap-5 p-4">
      <Card className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Button id="theme-light" variant="outline" onClick={() => setTheme('light')}>light</Button>
          <Button id="theme-dark" variant="outline" onClick={() => setTheme('dark')}>dark</Button>
          <Button id="theme-system" variant="outline" onClick={() => setTheme('system')}>system</Button>
          <Button id="lang-en" variant="outline" onClick={() => setLang('en')}>EN</Button>
          <Button id="lang-ms" variant="outline" onClick={() => setLang('ms')}>BM</Button>
        </div>
        <p id="i18n-client" className="text-sm text-muted">
          {t('home.greeting.afternoon', { name: 'Aisyah' })} | {t('nav.home')} {t('nav.map')} {t('nav.create')} {t('nav.community')} {t('nav.me')} | {t('community.tab.share')}
        </p>
      </Card>

      <section className="grid grid-cols-4 gap-2" aria-label="swatches">
        {swatches.map((cls) => (
          <div key={cls} data-swatch={cls} className={`${cls} grid h-12 place-items-center rounded-lg border text-[9px] font-bold text-on-ink`}>{cls.slice(3)}</div>
        ))}
      </section>
      <section className="grid grid-cols-2 gap-1 text-sm font-bold" aria-label="text colours">
        {texts.map((cls) => (
          <span key={cls} data-text={cls} className={cls}>{cls}</span>
        ))}
      </section>

      <section className="grid gap-2" aria-label="buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="ink">Ink</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="gradient">Gradient</Button>
          <Button disabled>Disabled</Button>
        </div>
        <Button variant="gradient" size="lg" className="w-full">Request to borrow</Button>
        <a href="#x" className={buttonClasses('outline')}>Link styled as button</a>
        <div className="flex gap-2">
          <IconButton label="Notifications">🔔</IconButton>
          <IconButton label="Back">←</IconButton>
          <div className="bg-brand-gradient flex gap-2 rounded-xl p-2">
            <IconButton label="Inbox" tone="overlay">💬</IconButton>
            <IconButton label="Bell" tone="overlay">🔔</IconButton>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2" aria-label="tags">
        <Tag>info</Tag><Tag variant="orange">orange</Tag><Tag variant="purple">purple</Tag><Tag variant="green">green</Tag><Tag variant="amber">amber</Tag>
      </section>

      <section className="flex items-center gap-3" aria-label="avatars">
        <Avatar name="Aisyah Rahman" /><Avatar name="Daniel Tan" /><Avatar name="Cikgu Farah" size={32} /><Avatar name="Nur" size={56} /><Avatar name="Ravi Kumar" />
      </section>

      <section className="grid gap-3" aria-label="controls">
        <Segmented
          label="Demo segmented"
          value={seg}
          onChange={setSeg}
          options={[{ value: 'a', label: 'Offered (24)' }, { value: 'b', label: 'Requested (6)' }, { value: 'c', label: 'Mine' }]}
        />
        <div className="flex items-center justify-between rounded-xl border bg-surface px-4">
          <span id="dm" className="font-bold">Dark mode</span>
          <Switch id="sw-on" aria-labelledby="dm" checked={on} onChange={setOn} />
        </div>
        <div className="flex items-center justify-between rounded-xl border bg-surface px-4">
          <span id="dm2" className="font-bold">Off switch</span>
          <Switch id="sw-off" aria-labelledby="dm2" checked={off} onChange={setOff} />
        </div>
        <Field label="Email" hint="We never show it to neighbours">
          {(control) => <input {...control} type="email" placeholder="you@example.com" />}
        </Field>
        <Field label="Unit number" error="Enter your house number">
          {(control) => <input {...control} defaultValue="" />}
        </Field>
        <Field label="Note">
          {(control) => <textarea {...control} rows={2} />}
        </Field>
      </section>

      <Card as="section"><EmptyState icon="🔎" title="Nothing here yet" description="Be the first to start a group." action={<Button>Create a group</Button>} /></Card>

      <section className="flex flex-wrap gap-2" aria-label="sheets">
        <Button id="open-bottom" onClick={() => setSheet('bottom')}>Bottom sheet</Button>
        <Button id="open-right" onClick={() => setSheet('right')}>Right sheet</Button>
        <Button id="open-full" onClick={() => setSheet('full')}>Full sheet</Button>
      </section>
      <p className="h-[120vh] text-muted">tall filler so the body can scroll (scroll-lock check)</p>

      <Sheet open={sheet === 'bottom'} onClose={() => setSheet(null)} title="Create">
        <div className="grid gap-2 pb-2">
          {['Report an issue', 'Drop a map alert', 'Post in a group', 'Offer a service', 'List an item', 'Create an event'].map((x) => (
            <a key={x} href="#x" onClick={() => setSheet(null)} className={buttonClasses('outline')}>{x}</a>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'right'} onClose={() => setSheet(null)} title="Report #1042" side="right">
        <p className="text-muted">Right-side sheet content (dashboard).</p>
      </Sheet>
      <Sheet open={sheet === 'full'} onClose={() => setSheet(null)} side="full" aria-label="Check-in QR">
        <p className="text-muted">Full-screen sheet without a title.</p>
      </Sheet>
    </div>
  );
}
