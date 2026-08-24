import Image from 'next/image';

function Footer () {
  return (
    <footer id="om-tjansten" className="site-footer">
      <div className="site-shell site-footer__grid">
        <div className="site-footer__intro">
          <Image
            src="/img/partidata/logotyp.svg"
            alt="Partidata"
            width={225}
            height={53}
          />
          <p>
            Oberoende, partipolitiskt neutral datatjänst. Inte kopplad till
            någon myndighet eller något parti.
          </p>
        </div>

        <div>
          <h3>Datakällor</h3>
          <ul>
            <li>
              <a href="https://data.val.se/">Valmyndigheten — partibeteckningar och valdata</a>
            </li>
            <li>
              <a href="https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/lan-och-kommuner-i-kodnummerordning/">
                SCB — region- och kommunkoder
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3>Öppenhet</h3>
          <ul>
            <li><a href="https://github.com/swedev/partidata">Källkod och data på GitHub</a></li>
            <li><a href="https://creativecommons.org/publicdomain/zero/1.0/">Licens: CC0 1.0</a></li>
          </ul>
        </div>

        <div>
          <h3>Kontakt</h3>
          <ul>
            <li><a href="mailto:hello@swedev.org">hello@swedev.org</a></li>
            <li><a href="https://github.com/swedev/partidata/issues">Rapportera felaktig uppgift</a></li>
          </ul>
        </div>
      </div>

      <div className="site-footer__meta">
        <div className="site-shell site-footer__meta-inner">
          <span>Ett öppet projekt av <a href="https://swedev.org/">SweDev</a></span>
          <span>Data och källkod uppdateras via GitHub</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
