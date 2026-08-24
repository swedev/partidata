import Image from 'next/image';
import Link from 'next/link';

function Header () {
  return (
    <header className="site-header">
      <div className="site-shell site-header__inner">
        <Link href="/" className="site-header__brand" aria-label="Partidata – alla partier">
          <Image
            src="/img/partidata/logotyp.svg"
            alt="Partidata"
            width={205}
            height={48}
            priority
          />
        </Link>

        <nav className="site-header__nav" aria-label="Huvudnavigation">
          <Link href="/">Alla partier</Link>
          <a href="https://github.com/swedev/partidata">Data på GitHub</a>
          <a href="#om-tjansten">Om tjänsten</a>
        </nav>
      </div>
    </header>
  );
}

export default Header;
