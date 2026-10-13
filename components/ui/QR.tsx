import QRCode from 'qrcode';

/**
 * A QR code for `value`, always dark on white (even in dark mode) so phone cameras read it.
 * Server component: the SVG is generated at render time. `label` says what scanning it does.
 */
export async function QR({
  value,
  label,
  size = 208,
  className = '',
}: {
  value: string;
  label: string;
  size?: number;
  className?: string;
}) {
  const svg = await QRCode.toString(value, { type: 'svg', margin: 1 });
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className={`rounded-xl bg-white p-2 [&>svg]:size-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
