import React from 'react';
import { Composition } from 'remotion';
import { VIDEO } from './theme/tokens';
import { HomeOverview } from './compositions/HomeOverview';
import { TicketFlow } from './compositions/TicketFlow';
import { Insights } from './compositions/Insights';
import { WhatsAppBot } from './compositions/WhatsAppBot';

const base = {
  width: VIDEO.width,
  height: VIDEO.height,
  fps: VIDEO.fps,
  // To add music: pass { music: 'music.mp3' } (file in promo/public/).
  defaultProps: { music: undefined as string | undefined },
};

export const RemotionRoot: React.FC = () => (
  <>
    {/* Home overview: dashboard scroll → Gastos + filtros → logo. (24s) */}
    <Composition id="Home" component={HomeOverview} {...base} durationInFrames={640} />
    {/* Ticket flow: foto → IA lee → revisar → guardado. (~23s) */}
    <Composition id="Tickets" component={TicketFlow} {...base} durationInFrames={940} />
    {/* Insights: intro → section tour (cards fly forward) → outro. (27s) */}
    <Composition id="Insights" component={Insights} {...base} durationInFrames={810} />
    {/* WhatsApp bot: hook → vincular flow → chat capture → logo. (25s) */}
    <Composition id="WhatsAppBot" component={WhatsAppBot} {...base} durationInFrames={750} />
  </>
);
