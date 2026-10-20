import { useEffect } from 'react';
import { Route, Routes, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { Flotte } from '../pages/Flotte';
import { MissionEditeur } from '../pages/MissionEditeur';
import { Missions } from '../pages/Missions';
import { NouvellePrimitive } from '../pages/NouvellePrimitive';
import { Primitives } from '../pages/Primitives';
import { RobotDetail } from '../pages/RobotDetail';
import { Icone } from './ui';

/** Les écrans qui prennent toute la scène ; les autres s'ouvrent en panneau sur le côté. */
const GRANDS = ['/missions/:id', '/primitives/nouvelle'];

/** Les écrans de l'appli, ouverts par-dessus la vue 3D. L'adresse dit lequel ; « / » n'en ouvre aucun. */
export function Overlay() {
  const lieu = useLocation();
  const naviguer = useNavigate();
  const ouvert = lieu.pathname !== '/';
  const grand = GRANDS.some((g) => matchPath(g, lieu.pathname));

  useEffect(() => {
    if (!ouvert) return;
    const touche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (e.key === 'Escape' && !cible.closest('input, textarea, select')) naviguer('/');
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [ouvert, naviguer]);

  if (!ouvert) return null;
  return (
    <>
      <div className="overlay-voile" onClick={() => naviguer('/')} aria-hidden="true" />
      <section className={`overlay hud-theme ${grand ? 'overlay-grand' : 'overlay-cote'}`} role="dialog" aria-modal="true">
        <button className="overlay-fermer" onClick={() => naviguer('/')} aria-label="Fermer">
          <Icone nom="croix" taille={18} />
        </button>
        <div className="overlay-corps">
          <Routes>
            <Route path="flotte" element={<Flotte />} />
            <Route path="flotte/:id" element={<RobotDetail />} />
            <Route path="missions" element={<Missions />} />
            <Route path="missions/:id" element={<MissionEditeur />} />
            <Route path="primitives" element={<Primitives />} />
            <Route path="primitives/nouvelle" element={<NouvellePrimitive />} />
          </Routes>
        </div>
      </section>
    </>
  );
}
