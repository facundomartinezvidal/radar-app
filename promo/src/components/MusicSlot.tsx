import React from 'react';
import { Audio, staticFile } from 'remotion';

/**
 * Optional background music. Renders nothing when `src` is undefined, so videos
 * render silently out of the box. To add music, drop a royalty-free track in
 * promo/public/ and pass its filename, e.g. <MusicSlot src="music.mp3" />.
 */
export const MusicSlot: React.FC<{ src?: string; volume?: number }> = ({ src, volume = 0.6 }) => {
  if (!src) return null;
  return <Audio src={staticFile(src)} volume={volume} />;
};
