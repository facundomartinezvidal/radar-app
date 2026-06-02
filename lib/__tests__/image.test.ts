/**
 * Tests for compressForOcr (lib/image.ts).
 *
 * Verifies the happy path, correct manipulator args, and the error thrown
 * when expo-image-manipulator yields no base64 payload.
 */
import { compressForOcr } from '@/lib/image';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

// Leaf mocks — reassigned before each test via makeMocks() so every test
// gets a fully independent call chain.
let mockSaveAsync: jest.Mock;
let mockRenderAsync: jest.Mock;
let mockResize: jest.Mock;
let mockManipulate: jest.Mock;

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    // Delegates to the module-level variable so fresh mocks installed by
    // makeMocks() are always picked up (closure over the binding, not value).
    manipulate: (...args: unknown[]) => mockManipulate(...args),
  },
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

type MakeMocksOptions = {
  /** Base64 string included in saveAsync result; pass `null` to omit it. */
  base64: string | null;
};

/**
 * Create a fresh set of mock functions and wire up the full call chain.
 * Use `{ base64: null }` to simulate a manipulator that yields no base64
 * (triggers the error branch in compressForOcr).
 */
function makeMocks({ base64 }: MakeMocksOptions = { base64: 'abc123base64==' }) {
  // NOTE: expo-image-manipulator ImageResult.base64 is typed as `string | undefined`.
  // We pass `null` as sentinel here and coerce to `undefined` in the mock result
  // so that `!result.base64` evaluates to `true` in the implementation.
  const base64Value: string | undefined = base64 === null ? undefined : base64;

  mockSaveAsync = jest.fn().mockResolvedValue({
    uri: 'file:///tmp/out.jpg',
    width: 800,
    height: 600,
    base64: base64Value,
  });

  mockRenderAsync = jest.fn().mockResolvedValue({
    width: 800,
    height: 600,
    saveAsync: mockSaveAsync,
  });

  // resize returns the context object for chaining; the implementation
  // discards the return value but we wire it up for completeness.
  mockResize = jest.fn().mockReturnValue({
    resize: mockResize,
    renderAsync: mockRenderAsync,
  });

  mockManipulate = jest.fn().mockReturnValue({
    resize: mockResize,
    renderAsync: mockRenderAsync,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compressForOcr', () => {
  describe('happy path', () => {
    it('returns { base64, mimeType: "image/jpeg" }', async () => {
      makeMocks({ base64: 'abc123base64==' });

      const result = await compressForOcr('file:///local/receipt.jpg');

      expect(result).toEqual({
        base64: 'abc123base64==',
        mimeType: 'image/jpeg',
      });
    });

    it('calls ImageManipulator.manipulate with the provided uri', async () => {
      makeMocks();

      await compressForOcr('file:///local/receipt.jpg');

      expect(mockManipulate).toHaveBeenCalledWith('file:///local/receipt.jpg');
    });

    it('calls resize with max width 1024', async () => {
      makeMocks();

      await compressForOcr('file:///local/receipt.jpg');

      expect(mockResize).toHaveBeenCalledWith({ width: 1024 });
    });

    it('calls saveAsync with compress 0.6, format JPEG, and base64 true', async () => {
      makeMocks();

      await compressForOcr('file:///local/receipt.jpg');

      expect(mockSaveAsync).toHaveBeenCalledWith({
        compress: 0.6,
        format: 'jpeg',
        base64: true,
      });
    });
  });

  describe('error path', () => {
    it('throws "No se pudo procesar la imagen." when base64 is absent', async () => {
      makeMocks({ base64: null });

      await expect(compressForOcr('file:///local/receipt.jpg')).rejects.toThrow(
        'No se pudo procesar la imagen.',
      );
    });

    it('throws an Error instance (not a string) when base64 is missing', async () => {
      makeMocks({ base64: null });

      const caught = await compressForOcr('file:///local/receipt.jpg').catch((e: unknown) => e);

      expect(caught).toBeInstanceOf(Error);
    });
  });
});
