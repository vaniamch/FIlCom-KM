import { resolveStoredFileUrl } from './fileUpload';

export function isDataUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('data:');
}

export function isFirebaseStorageUrl(url: string): boolean {
  return (
    typeof url === 'string' &&
    (url.includes('firebasestorage.googleapis.com') || url.startsWith('gs://'))
  );
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

  if (header.includes(';base64')) {
    const byteString = atob(base64Data || '');
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeType });
  }

  return new Blob([decodeURIComponent(base64Data || '')], { type: mimeType });
}

export async function triggerFileDownload(rawUrl: string, fileName: string): Promise<boolean> {
  if (!rawUrl) return false;

  try {
    const url = await resolveStoredFileUrl(rawUrl);

    if (isDataUrl(url)) {
      const blob = dataUrlToBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      return true;
    }

    // Try fetching as Blob first (ideal for Firebase Storage URLs so browser downloads instead of navigating)
    if (isFirebaseStorageUrl(url) || url.startsWith('blob:')) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = fileName || 'document';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
          return true;
        }
      } catch {
        // Fall through to anchor download
      }
    }

    if (!/^https?:\/\//i.test(url)) {
      return false;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'document';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Download error:', err);
    return false;
  }
}

export function downloadTextAsFile(fileName: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export function getGoogleDrivePreviewUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('google.com')) return null;

    // Docs / Sheets / Slides
    if (
      parsed.pathname.includes('/document/d/') ||
      parsed.pathname.includes('/spreadsheets/d/') ||
      parsed.pathname.includes('/presentation/d/')
    ) {
      return url.replace(/\/(edit|view).*$/, '/preview');
    }
    // Drive file
    const driveMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    return null;
  } catch {
    return null;
  }
}
