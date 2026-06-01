import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface CompressedImage {
  base64: string;
  mimeType: 'image/jpeg';
}

/**
 * Compress and resize a receipt photo so it is ready to be sent to the OCR
 * edge function. The output is always a JPEG to keep the payload small and
 * well below the <4 MB Groq base64 limit.
 *
 * Resizes to a maximum width of 1024 px (preserving aspect ratio), compresses
 * at quality 0.6, and requests the base64 encoding in the same call.
 *
 * @param uri Local `file://` URI of the original receipt photo.
 * @returns `{ base64, mimeType }` ready to embed in a JSON POST body.
 */
export async function compressForOcr(uri: string): Promise<CompressedImage> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1024 });

  const imageRef = await context.renderAsync();
  const result = await imageRef.saveAsync({
    compress: 0.6,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error('No se pudo procesar la imagen.');
  }

  return { base64: result.base64, mimeType: 'image/jpeg' };
}
