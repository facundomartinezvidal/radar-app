import { Config } from '@remotion/cli/config';

// Vertical 9:16 for Reels / Stories / TikTok.
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setConcurrency(null);
// Dimensions/fps/duration are declared per <Composition> in src/Root.tsx.
