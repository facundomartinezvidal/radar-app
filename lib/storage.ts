import { supabase } from '@/lib/supabase';

export interface UploadMediaOptions {
  /** Supabase Storage bucket name. Defaults to `'media'`. */
  bucket?: string;
  /** Authenticated user ID — used as the top-level folder. */
  userId: string;
  /** Local `file://` URI returned by expo-camera or expo-image-picker. */
  fileUri: string;
  /** MIME type override. When omitted the extension from `fileUri` is used. */
  mimeType?: string;
}

export interface UploadMediaResult {
  path: string;
  publicUrl: string;
}

/** Generate a 6-character alphanumeric random suffix without external deps. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Infer a file extension from a URI, returning `'jpg'` as a safe fallback. */
function extensionFromUri(uri: string): string {
  const lastSegment = uri.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === lastSegment.length - 1) return 'jpg';
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

/** Infer a MIME type from a file extension. */
function mimeFromExtension(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Upload a local media file to Supabase Storage.
 *
 * Uses `fetch + arrayBuffer` — the recommended pattern for React Native /
 * Expo because it avoids the memory overhead of base64.
 *
 * Returns `null` when the target bucket does not exist (logs a console warning
 * instead of throwing), and re-throws all other errors.
 */
export async function uploadMediaToSupabase(
  opts: UploadMediaOptions,
): Promise<UploadMediaResult | null> {
  const { userId, fileUri, bucket = 'media' } = opts;

  const ext = extensionFromUri(fileUri);
  const contentType = opts.mimeType ?? mimeFromExtension(ext);

  const timestamp = Date.now();
  const path = `${userId}/${timestamp}-${randomSuffix()}.${ext}`;

  // Fetch the local file as binary — this works in Expo/RN for file:// URIs.
  const response = await fetch(fileUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType, upsert: false });

  if (uploadError) {
    const message = uploadError.message ?? '';
    const isBucketMissing =
      message.toLowerCase().includes('bucket not found') ||
      message.toLowerCase().includes('not found') ||
      // Supabase Storage returns status 404 when the bucket is absent;
      // the error object may expose it via a `statusCode` property.
      ('statusCode' in uploadError &&
        (uploadError as unknown as { statusCode: number | string }).statusCode === 404);

    if (isBucketMissing) {
      console.warn(
        `[storage] Storage bucket '${bucket}' does not exist — create it in the Supabase dashboard.`,
      );
      return null;
    }

    throw uploadError;
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return { path, publicUrl: urlData.publicUrl };
}
