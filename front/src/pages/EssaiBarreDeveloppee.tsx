import { useState } from 'react';
import { BarreFil } from '../components/lecture/BarreFil';
import { Developpe } from '../components/lecture/Developpe';
import { MISSIONS_ESSAI, PRIMITIVES_ESSAI, useScenario, type MissionEssai } from '../components/lecture/scenario';

const MISSIONS = [
  { cle: 'prototype', libelle: 'Vider la table, en boucle' },
  { cle: 'longue', libelle: 'Longue · branche échec · ×3' },
  { cle: 'courte', libelle: 'Courte · ×4' },
] as const;

const VITESSES = [1, 3, 8];

/** Ce que la maquette propose, et ce qu'il faudra au back pour le brancher. */
const POINTS = [
  { titre: 'Stop dans la barre', texte: 'Un carré à maintenir une seconde : pendant l’appui il rougit et son anneau se remplit ; au bout, la mission s’arrête et la barre prend le halo rouge, « Arrêtée par l’opérateur », jusqu’à l’acquittement. Un appui trop court le dit. Le contrat a déjà arreterMission.' },
  { titre: 'Le workflow déplié', texte: 'Toucher la barre déplie, dessous, la mission dans le canevas de l’éditeur, en lecture : les états du tour, les fils pris, le temps de l’étape sous sa tuile, et la vue qui suit l’étape en cours. La croix, ou toucher encore la barre, le replie. En pause, arrêtée ou finie, la barre se dégage d’un glissé vers le haut ou vers la droite.' },
  { titre: 'Lecture · pause · pas à pas', texte: 'Au bas du déplié, des boutons de même taille : stop, lecture / pause, et le mode pas à pas — la mission se met en pause à la fin de chaque étape. Dans ce mode seulement, « étape suivante » apparaît. Une seule action est pleine à la fois, l’en-tête dit le mode. Il faudra au back : un mode pas à pas, etapeSuivante(robotId), et Execution.pasAPas.' },
];

/** La barre et son workflow déplié, menés par une mission simulée. */
function Banc({ essai, vitesse }: { essai: MissionEssai; vitesse: number }) {
  const s = useScenario(essai, vitesse);
  const [developpe, setDeveloppe] = useState(false);
  const [cachee, setCachee] = useState(false);
  const l = s.lecture;
  const fini = l.etat === 'reussie' || l.etat === 'erreur' || l.etat === 'arretee';
  if (cachee && l.etat === 'pause') {
    return <div className="bd-scene"><button className="lm-bouton" onClick={() => setCachee(false)}>Faire revenir la barre</button></div>;
  }
  return (
    <div className="bd-scene">
      <BarreFil l={l} pause={s.pause} acquitter={s.acquitter} arreter={s.arreter} developpe={developpe}
        ouvrir={() => setDeveloppe(!developpe)} degager={() => (fini ? s.rearmer() : setCachee(true))}>
        {developpe && (
          <Developpe l={l} mission={essai.mission} primitives={PRIMITIVES_ESSAI} pause={s.pause}
            basculerPasAPas={s.basculerPasAPas} etape={s.etape} arreter={s.arreter} fermer={() => setDeveloppe(false)} />
        )}
      </BarreFil>
      {!developpe && <p className="bd-astuce">Touchez la barre pour voir le workflow en exécution. En pause, arrêtée ou finie, glissez-la vers le haut ou vers la droite pour la dégager.</p>}
    </div>
  );
}

/** Maquette : un stop dans la barre, le workflow déplié, lecture / pause / pas à pas (#/essai/barre-developpee). */
export function EssaiBarreDeveloppee() {
  const [mission, setMission] = useState<keyof typeof MISSIONS_ESSAI>('prototype');
  const [vitesse, setVitesse] = useState(3);
  return (
    <div className="lm-page fond-hud bl-page">
      <header className="lm-page-tete">
        <p className="essai-barre-sur">MAQUETTE · BARRE DÉVELOPPÉE</p>
        <span className="em-segment lm-choix">
          {MISSIONS.map((m) => (
            <button key={m.cle} className={mission === m.cle ? 'actif' : ''} onClick={() => setMission(m.cle)}>{m.libelle}</button>
          ))}
        </span>
        <span className="em-segment lm-choix">
          {VITESSES.map((v) => <button key={v} className={vitesse === v ? 'actif' : ''} onClick={() => setVitesse(v)}>×{v}</button>)}
        </span>
      </header>
      <Banc key={mission} essai={MISSIONS_ESSAI[mission]} vitesse={vitesse} />
      <div className="bl-systeme bd-points">
        {POINTS.map((p, i) => (
          <div key={p.titre}>
            <span className="bl-signe" style={{ ['--c' as string]: '#e9eef7' }}>{i + 1}</span>
            <span><b>{p.titre}</b><span>{p.texte}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
