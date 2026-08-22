import '../styles/base.scss';

import type { AppProps } from 'next/app';

function Partidata ({ Component, pageProps }: AppProps) {
  return (
    <Component {...pageProps} />
  );
}

export default Partidata;
