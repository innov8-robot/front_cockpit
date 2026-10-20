import { NavLink, Outlet } from 'react-router-dom';
import { enSimulation } from '../api/client';
import { reinitialiserSimulation } from '../api/mock';
import { Icone } from './ui';

const ONGLETS = [
  { vers: '/', libelle: 'Robot', icone: 'robot' },
  { vers: '/flotte', libelle: 'Flotte', icone: 'flotte' },
  { vers: '/missions', libelle: 'Missions', icone: 'missions' },
  { vers: '/primitives', libelle: 'Primitives', icone: 'primitives' },
];

export function Coquille() {
  return (
    <div className="coquille">
      <aside className="barre-laterale">
        <div className="marque">
          <span className="marque-logo" aria-hidden="true" />
          <span>Robotique</span>
        </div>
        <nav>
          {ONGLETS.map((o) => (
            <NavLink key={o.vers} to={o.vers} end={o.vers === '/'} className="lien-nav">
              <Icone nom={o.icone} />
              {o.libelle}
            </NavLink>
          ))}
        </nav>
        {enSimulation && (
          <div className="bandeau-simulation">
            Données simulées
            <button className="lien" onClick={() => { reinitialiserSimulation(); location.reload(); }}>
              Réinitialiser
            </button>
          </div>
        )}
      </aside>

      <main className="contenu">
        <Outlet />
      </main>

      <nav className="onglets-bas">
        {ONGLETS.map((o) => (
          <NavLink key={o.vers} to={o.vers} end={o.vers === '/'} className="onglet-bas">
            <Icone nom={o.icone} />
            <span>{o.libelle}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
