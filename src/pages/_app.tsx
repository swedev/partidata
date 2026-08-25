import '../styles/base.scss';

import type { AppProps } from 'next/app';
import { Hanken_Grotesk, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google';

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-partidata-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-partidata-mono',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-partidata-serif',
  display: 'swap',
});

function Partidata ({ Component, pageProps }: AppProps) {
  return (
    <div className={`${hankenGrotesk.className} ${hankenGrotesk.variable} ${ibmPlexMono.variable} ${sourceSerif.variable} app-root`}>
      <Component {...pageProps} />
    </div>
  );
}

export default Partidata;
