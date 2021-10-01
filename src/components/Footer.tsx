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
        <div className="flex-1 p-3">
          <h4>Header</h4>
          <ul>
            <li>Lorem ipsum dolor sit</li>
            <li>Dolor sit ipsum</li>
            <li>Ipsum dolor sit lorem</li>
          </ul>
        </div>
        <div className="flex-1 p-3">
          <h4>Header</h4>
          <ul>
            <li>Lorem ipsum dolor sit</li>
            <li>Dolor sit ipsum</li>
            <li>Ipsum dolor sit lorem</li>
          </ul>
        </div>
        <div className="flex-1 p-3">
          <h4>Header</h4>
          <ul>
            <li>Lorem ipsum dolor sit</li>
            <li>Dolor sit ipsum</li>
            <li>Ipsum dolor sit lorem</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
