// Every on-screen word, per language. '|' breaks a line, *words* go serif italic, {chip} inserts a chip.
export const COPY = {
  en: {
    h1: 'Your competitor’s post got',
    big: '1,248,302',
    views: 'views',
    h2: 'What if it all ran *on its own?*',
    url: 'yoursite.com',
    btn: 'Continue',
    call: 'It reads your site',
  },
  fr: {
    h1: 'Le post de ton concurrent a fait',
    big: '1 248 302',
    views: 'vues',
    h2: 'Et si tout tournait *tout seul ?*',
    url: 'tonsite.com',
    btn: 'Continuer',
    call: 'Il lit ton site',
  },
};
export type Copy = (typeof COPY)['en'];
