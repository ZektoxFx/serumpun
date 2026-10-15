'use client';

import { useEffect, useRef, useState } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';
import { createBrowserClient } from '@/lib/supabase/client';

/** The longest side of an uploaded photo, in pixels. */
const MAX_SIDE = 1280;

/**
 * The picked photo as a JPEG (quality 0.8) at most 1280 px on its longest side. Redrawing it also leaves behind the
 * camera's metadata, including the GPS position a phone stores in every photo. An <img> is used rather than
 * createImageBitmap because every browser turns it the right way up from the camera's orientation tag.
 */
async function shrinkPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // throws on a file the browser cannot read
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob) throw new Error('the photo could not be encoded');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Uploads a photo as the form is sent, and returns its object path for the RPC. A public photo gets a random name at
 * the root of `photos`, so its link names nobody; a private one goes in the sender's own folder of `private-photos`
 * (`privateFor` is their user id). The bucket is chosen at sending time, so changing "Keep private" after picking the
 * photo can never leave it in the wrong one.
 */
export async function uploadPhoto(photo: Blob, privateFor?: string): Promise<string> {
  const path = `${privateFor ? `${privateFor}/` : ''}${crypto.randomUUID()}.jpg`;
  const { error } = await createBrowserClient()
    .storage.from(privateFor ? 'private-photos' : 'photos')
    .upload(path, photo, { contentType: 'image/jpeg' });
  if (error) throw new Error(`photo upload failed: ${error.message}`);
  return path;
}

/** The link to a photo in the public `photos` bucket (no request is made). */
export function publicPhotoUrl(path: string): string {
  return createBrowserClient().storage.from('photos').getPublicUrl(path).data.publicUrl;
}

/**
 * "Add photo": take or pick one photo, shrunk in the browser, with a preview and a way to remove it. Nothing is uploaded
 * here; the form uploads `onChange`'s blob when it is sent (uploadPhoto).
 */
export function PhotoInput({ onChange, disabled = false }: { onChange: (photo: Blob | null) => void; disabled?: boolean }) {
  const t = useT();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const shown = useRef<string | null>(null);
  useEffect(() => () => void (shown.current && URL.revokeObjectURL(shown.current)), []);

  function show(photo: Blob | null) {
    if (shown.current) URL.revokeObjectURL(shown.current);
    shown.current = photo && URL.createObjectURL(photo);
    setPreview(shown.current);
    onChange(photo);
  }

  return (
    <div className="grid gap-2">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, nothing for the image optimiser to do
        <img src={preview} alt={t('photo.picked')} className="max-h-56 w-full rounded-xl border border-line object-cover" />
      )}
      <div className="flex flex-wrap gap-2">
        <label
          className={`${buttonClasses('outline')} flex-1 cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-text has-disabled:pointer-events-none has-disabled:opacity-50`}
        >
          <span aria-hidden="true">📷</span>
          {t(preview ? 'photo.change' : 'photo.add')}
          <input
            type="file"
            accept="image/*"
            disabled={disabled || busy}
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = ''; // picking the same file again still fires a change
              if (!file) return;
              setBusy(true);
              setUnreadable(false);
              try {
                show(await shrinkPhoto(file));
              } catch {
                setUnreadable(true); // keeps the photo that was there
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {preview && (
          <button type="button" disabled={disabled} onClick={() => show(null)} className={buttonClasses('outline')}>
            {t('photo.remove')}
          </button>
        )}
      </div>
      {unreadable && (
        <p role="alert" className="text-sm font-bold text-red-text">
          {t('photo.error.read')}
        </p>
      )}
    </div>
  );
}
