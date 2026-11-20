import { Config } from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(17);
// Le Chrome de Remotion plante quand son chemin contient une espace (« AI Carousel Maker ») :
// REMOTION_CHROME pointe vers une copie de node_modules/.remotion/chrome-headless-shell ailleurs.
if (process.env.REMOTION_CHROME) Config.setBrowserExecutable(process.env.REMOTION_CHROME);
