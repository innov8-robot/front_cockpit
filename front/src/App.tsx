import { HashRouter, Route, Routes } from 'react-router-dom';
import { Accueil } from './pages/Accueil';
import { EssaiBarre } from './pages/EssaiBarre';
import { EssaiCalques } from './pages/EssaiCalques';
import { EssaiDA } from './pages/EssaiDA';
import { EssaiLogique } from './pages/EssaiLogique';
import { EssaiMissions } from './pages/EssaiMissions';

/**
 * Une seule page : la vue 3D du robot. Les autres écrans s'ouvrent par-dessus, selon l'adresse.
 * HashRouter : les liens marchent aussi dans l'APK Android, sans réécriture côté serveur.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/essai/barre" element={<EssaiBarre />} />
        <Route path="/essai/calques" element={<EssaiCalques />} />
        <Route path="/essai/da" element={<EssaiDA />} />
        <Route path="/essai/missions" element={<EssaiMissions />} />
        <Route path="/essai/logique" element={<EssaiLogique />} />
        <Route path="*" element={<Accueil />} />
      </Routes>
    </HashRouter>
  );
}
