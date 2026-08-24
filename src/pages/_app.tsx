import '../styles/base.scss';

import type { AppProps } from 'next/app';
import { Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';

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

function Partidata ({ Component, pageProps }: AppProps) {
  return (
    <div className={`${hankenGrotesk.variable} ${ibmPlexMono.variable} app-root`}>
      <Component {...pageProps} />
    </div>
  );
}

export default Partidata;
