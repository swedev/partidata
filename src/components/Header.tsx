import Image from 'next/image';
import Link from 'next/link';

function Header () {
  return (
    <header className="site-header">
      <div className="site-shell site-header__inner">
        <Image
          className="site-header__parliament"
          src="/img/sveriges_riksdag.svg"
          alt=""
          width={512}
          height={256}
          aria-hidden="true"
          loading="eager"
        />

        <Link href="/" className="site-header__brand" aria-label="Partidata – alla partier">
          <Image
            src="/img/partidata/logotyp.svg"
            alt="Partidata"
            width={4661}
            height={1090}
            loading="eager"
          />
        </Link>

        <nav className="site-header__nav" aria-label="Huvudnavigation">
          <Link href="/" className="site-header__active-link">Partier</Link>
          <a href="https://github.com/swedev/partidata">Data på GitHub</a>
          <a href="#om-tjansten">Om tjänsten</a>
        </nav>
      </div>
    </header>
  );
}

export default Header;
