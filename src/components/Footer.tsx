import SweDevLogo from 'src/components/SweDevLogo';

function Footer () {
  return (
    <footer className="bg-swe-gradient text-yellow-200 text-sm">
      <div className="container flex flex-row py-6">
        <div className="flex-1 p-3">
          <SweDevLogo
            className="fill-current w-4/5"
          />
        </div>
        <div className="flex-1 p-3 break-words">
          <h4>Om Partidata</h4>
          <p className="mt-2">
            Öppen data om svenska partiers registrerade partibeteckningar
            och anmälda deltagande i val.
          </p>
          <p className="mt-2">
            <a href="https://github.com/swedev/partidata" className="text-yellow-200 underline">
              Källkod och data på GitHub
            </a>
          </p>
        </div>
        <div className="flex-1 p-3 break-words">
          <h4>Datakällor</h4>
          <ul className="mt-2">
            <li>
              <a
                href="https://www.val.se/for-partier/partibeteckning/registrerade-partibeteckningar.html"
                className="text-yellow-200 underline"
              >
                Valmyndigheten
              </a>
              {' '}— partibeteckningar
            </li>
            <li className="mt-2">
              <a
                href="https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/lan-och-kommuner/lan-och-kommuner-i-kodnummerordning/"
                className="text-yellow-200 underline"
              >
                SCB
              </a>
              {' '}— läns- och kommunkoder
            </li>
          </ul>
          <p className="mt-2">
            Fri att använda{' '}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              className="text-yellow-200 underline"
            >
              (CC0 1.0)
            </a>
          </p>
        </div>
        <div className="flex-1 p-3 break-words">
          <h4>Kontakt</h4>
          <ul className="mt-2">
            <li>
              <a href="mailto:hello@swedev.org" className="text-yellow-200 underline">
                hello@swedev.org
              </a>
            </li>
            <li className="mt-2">
              <a href="https://github.com/swedev/partidata/issues" className="text-yellow-200 underline">
                Rapportera fel eller bidra
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
