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
            Öppen data om politiska partier i Sverige, samlad för att kunna
            granskas, återanvändas och förbättras av fler.
          </p>
          <p className="site-footer__credit">
            Ett öppet projekt av <a href="https://swedev.org/">SweDev</a>.
          </p>
        </div>

        <div>
          <h2>Datakällor</h2>
          <ul>
            <li>
              <a href="https://data.val.se/">Valmyndigheten</a>
              <span>Partibeteckningar och anmält deltagande i val</span>
            </li>
            <li>
              <a href="https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/lan-och-kommuner-i-kodnummerordning/">
                SCB
              </a>
              <span>Läns- och kommunkoder</span>
            </li>
          </ul>
        </div>

        <div>
          <h2>Öppen data</h2>
          <ul>
            <li><a href="https://github.com/swedev/partidata">Källkod och data på GitHub</a></li>
            <li><a href="https://creativecommons.org/publicdomain/zero/1.0/">Fri att använda under CC0 1.0</a></li>
            <li><a href="https://github.com/swedev/partidata/issues">Rapportera fel eller bidra</a></li>
          </ul>
        </div>

        <div>
          <h2>Kontakt</h2>
          <p>
            <a href="mailto:hello@swedev.org">hello@swedev.org</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
