import { getUploads } from './runtime.js';

/** DB stores `/uploads/<key>`; R2 uses just `<key>`. */
export function uploadKey(filePath: string): string {
  return filePath.split('/').filter(Boolean).pop() ?? filePath;
}

export async function putUpload(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  await getUploads().put(key, data, {
    httpMetadata: { contentType: contentType || 'application/octet-stream' },
  });
}

export async function deleteUpload(filePath: string): Promise<void> {
  try {
    await getUploads().delete(uploadKey(filePath));
  } catch {
    // Already gone or an invalid legacy path — deletion is best effort.
  }
}

export async function getUpload(key: string): Promise<R2ObjectBody | null> {
  return await getUploads().get(key);
}
