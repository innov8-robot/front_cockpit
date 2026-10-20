import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Coquille } from './components/Coquille';
import { Accueil } from './pages/Accueil';
import { Flotte } from './pages/Flotte';
import { MissionEditeur } from './pages/MissionEditeur';
import { Missions } from './pages/Missions';
import { NouvellePrimitive } from './pages/NouvellePrimitive';
import { Primitives } from './pages/Primitives';
import { RobotDetail } from './pages/RobotDetail';

/** HashRouter : les liens marchent aussi dans l'APK Android, sans réécriture côté serveur. */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route index element={<Accueil />} />
        <Route element={<Coquille />}>
          <Route path="flotte" element={<Flotte />} />
          <Route path="flotte/:id" element={<RobotDetail />} />
          <Route path="primitives" element={<Primitives />} />
          <Route path="primitives/nouvelle" element={<NouvellePrimitive />} />
          <Route path="missions" element={<Missions />} />
          <Route path="missions/:id" element={<MissionEditeur />} />
          <Route path="*" element={<Navigate to="/flotte" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
