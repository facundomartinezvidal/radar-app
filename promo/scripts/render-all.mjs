// Renders all five compositions to promo/out/*.mp4
import { execSync } from 'node:child_process';

const comps = ['Home', 'Insights'];
const music = process.env.PROMO_MUSIC; // optional filename in public/

for (const id of comps) {
  const props = music ? `--props='${JSON.stringify({ music })}'` : '';
  const cmd = `npx remotion render src/index.ts ${id} out/${id}.mp4 ${props}`.trim();
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}
console.log('\n✓ All renders done → promo/out/');
