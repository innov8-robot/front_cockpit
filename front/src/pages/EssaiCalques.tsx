import { useState } from 'react';
import { CALQUES } from '../components/calques';
import {
  FiltresCalques, FiltresDock, FiltresInterrupteurs, FiltresLegende, FiltresRail, type ProprietesFiltres,
} from '../components/Filtres';
import type { Calque } from '../vue3d/scene';

const PROPOSITIONS: { lettre: string; nom: string; idee: string; Filtres: (p: ProprietesFiltres) => React.JSX.Element }[] = [
  { lettre: '✓', nom: 'B repliable · retenue', idee: 'Les interrupteurs de B dans la coque de D : c’est celle de l’accueil.', Filtres: FiltresCalques },
  { lettre: 'A', nom: 'Rail d’icônes', idee: 'Le plus discret : 40 px de large, le nom et le détail au survol.', Filtres: FiltresRail },
  { lettre: 'B', nom: 'Interrupteurs', idee: 'Tout se lit sans survoler : le nom, le détail, l’état de l’interrupteur.', Filtres: FiltresInterrupteurs },
  { lettre: 'C', nom: 'Légende', idee: 'Filtre et légende à la fois : la couleur de chaque calque dans la scène.', Filtres: FiltresLegende },
  { lettre: 'D', nom: 'Repliable', idee: 'Un seul bouton et le compte ; la liste au clic. Rien ne reste à l’écran.', Filtres: FiltresDock },
];

/** Page d'essai des filtres de calques de l'accueil : #/essai/calques. */
export function EssaiCalques() {
  const [actifs, setActifs] = useState<Record<Calque, boolean>>(
    { robot: true, atelier: true, camera: true, lidar: true, objets: true, sol: false });
  const basculer = (cle: Calque) => setActifs({ ...actifs, [cle]: !actifs[cle] });

  return (
    <div className="essai-barre essai-calques fond-hud">
      <header className="essai-barre-tete">
        <div>
          <p className="essai-barre-sur">ESSAI · COMPOSANT</p>
          <h1>Filtres des calques</h1>
        </div>
        <p className="essai-calques-note">Les quatre partagent le même état : basculer un calque dans l’une le bascule dans toutes.</p>
      </header>
      <div className="essai-calques-grille">
        {PROPOSITIONS.map(({ lettre, nom, idee, Filtres }) => (
          <section key={lettre} className="essai-calques-case">
            <p className="essai-calques-titre"><span>{lettre}</span>{nom}</p>
            <p className="essai-calques-idee">{idee}</p>
            <div className="essai-calques-scene">
              <Filtres calques={CALQUES} actifs={actifs} basculer={basculer} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
