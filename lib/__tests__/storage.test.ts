import { uploadMediaToSupabase } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

// The supabase module is mocked globally in jest.setup.ts.
// We cast to jest.Mock so we can inspect and re-configure calls per test.
const mockFrom = supabase.storage.from as jest.Mock;

/** Build a stable mock for supabase.storage.from(bucket) per test. */
function mockStorageBucket(
  uploadResult: { error: null } | { error: { message: string; statusCode?: string | number } },
  publicUrlResult = 'https://test.supabase.co/storage/v1/object/public/media/path',
) {
  const mockUpload = jest.fn().mockResolvedValue(uploadResult);
  const mockGetPublicUrl = jest.fn().mockReturnValue({
    data: { publicUrl: publicUrlResult },
  });

  mockFrom.mockReturnValue({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  });

  return { mockUpload, mockGetPublicUrl };
}

/** Mock the global fetch so the storage helper can read a "local" file:// URI. */
function mockGlobalFetch(arrayBuffer: ArrayBuffer = new ArrayBuffer(8)) {
  // globalThis is the ESNext-standard way to access the global object.
  // It avoids a TypeScript error when @types/node is not in the project.
  (globalThis as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue({
    arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
  }) as unknown as typeof fetch;
}

describe('uploadMediaToSupabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGlobalFetch();
  });

  describe('bucket-not-found error handling', () => {
    it('returns null when the upload error message contains "Bucket not found"', async () => {
      mockStorageBucket({
        error: { message: 'Bucket not found', statusCode: '404' },
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await uploadMediaToSupabase({
        userId: 'user-1',
        fileUri: 'file:///local/photo.jpg',
        bucket: 'media',
      });

      expect(result).toBeNull();
      warnSpy.mockRestore();
    });

    it('logs a console.warn containing the bucket name when bucket is missing', async () => {
      mockStorageBucket({
        error: { message: 'Bucket not found', statusCode: '404' },
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await uploadMediaToSupabase({
        userId: 'user-1',
        fileUri: 'file:///local/photo.jpg',
        bucket: 'media',
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'media'"));
      warnSpy.mockRestore();
    });

    it('returns null when the upload error statusCode is 404 (numeric)', async () => {
      mockStorageBucket({
        error: { message: 'not found', statusCode: 404 },
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await uploadMediaToSupabase({
        userId: 'user-1',
        fileUri: 'file:///local/photo.jpg',
        bucket: 'custom-bucket',
      });

      expect(result).toBeNull();
      warnSpy.mockRestore();
    });
  });

  describe('successful upload', () => {
    it('returns an object with path and publicUrl on success', async () => {
      const publicUrl = 'https://test.supabase.co/storage/v1/object/public/media/user-1/file.jpg';
      mockStorageBucket({ error: null }, publicUrl);

      const result = await uploadMediaToSupabase({
        userId: 'user-1',
        fileUri: 'file:///local/photo.jpg',
        bucket: 'media',
      });

      expect(result).not.toBeNull();
      expect(result?.publicUrl).toBe(publicUrl);
    });

    it('includes the userId as a path prefix', async () => {
      mockStorageBucket({ error: null });

      const result = await uploadMediaToSupabase({
        userId: 'user-42',
        fileUri: 'file:///local/photo.jpg',
      });

      expect(result?.path).toMatch(/^user-42\//);
    });

    it('infers the extension from the fileUri when mimeType is not provided', async () => {
      mockStorageBucket({ error: null });

      const result = await uploadMediaToSupabase({
        userId: 'user-1',
        fileUri: 'file:///local/video.mp4',
      });

      expect(result?.path).toMatch(/\.mp4$/);
    });

    it('uses the default bucket "media" when bucket option is omitted', async () => {
      const { mockUpload } = mockStorageBucket({ error: null });
      // mockFrom is called with the bucket name; capture what it was called with.
      await uploadMediaToSupabase({
        userId: 'user-1',
        fileUri: 'file:///local/photo.jpg',
      });

      expect(mockFrom).toHaveBeenCalledWith('media');
    });

    it('calls fetch with the provided fileUri to read the binary data', async () => {
      mockStorageBucket({ error: null });

      await uploadMediaToSupabase({
        userId: 'user-1',
        fileUri: 'file:///local/photo.jpg',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('file:///local/photo.jpg');
    });
  });

  describe('non-bucket errors', () => {
    it('re-throws errors that are not bucket-missing errors', async () => {
      const networkError = { message: 'Network error', statusCode: '503' };
      mockStorageBucket({ error: networkError });

      await expect(
        uploadMediaToSupabase({
          userId: 'user-1',
          fileUri: 'file:///local/photo.jpg',
        }),
      ).rejects.toMatchObject({ message: 'Network error' });
    });
  });
});
