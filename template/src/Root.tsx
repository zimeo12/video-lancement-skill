import React from 'react';
import { Composition } from 'remotion';
import { Film, TOTAL } from './film';

export const Root: React.FC = () => (
  <Composition id="Launch" component={Film} durationInFrames={TOTAL} fps={60} width={1920} height={1080} defaultProps={{ lang: 'en' as 'en' | 'fr' }} />
);
