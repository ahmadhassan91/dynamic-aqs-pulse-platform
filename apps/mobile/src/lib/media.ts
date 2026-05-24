export async function uriToBase64(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export function mimeTypeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

export function extensionFromMimeType(mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (lower === 'image/png') return 'png';
  if (lower === 'image/webp') return 'webp';
  if (lower === 'application/pdf') return 'pdf';
  return 'jpg';
}
