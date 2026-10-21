import { useMissions } from '../components/listeMissions/donnees';
import { ListeApercu, ListeVivante } from '../components/listeMissions/Variantes';
import { Chargement } from '../components/ui';

/** Les missions en liste, dans le panneau de côté ; l'icône à côté du titre développe la vue. */
export function Missions() {
  const donnees = useMissions();
  if (!donnees.pret) return <Chargement />;
  return <ListeVivante {...donnees} bascule={{ vers: '/missions/developpees', developpee: false }} />;
}

/** Les missions développées, sur l'écran entier : la liste à gauche, la mission choisie à droite. */
export function MissionsDeveloppees() {
  const donnees = useMissions();
  if (!donnees.pret) return <Chargement />;
  return <ListeApercu {...donnees} bascule={{ vers: '/missions', developpee: true }} />;
}
