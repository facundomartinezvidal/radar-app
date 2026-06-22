import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

// Bundled into the render — no CDN fetch at render time.
const inter = loadInter('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});
const mono = loadMono('normal', {
  weights: ['400', '500'],
  subsets: ['latin'],
});

export const fontFamily = inter.fontFamily; // Inter — text
export const monoFamily = mono.fontFamily; // JetBrains Mono — amounts
