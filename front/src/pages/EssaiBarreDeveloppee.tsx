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
  { titre: 'Stop dans la barre', texte: 'Un carré à maintenir une seconde : l’anneau se remplit pendant l’appui, un appui trop court le dit. L’arrêt est gris (« Arrêtée par l’opérateur »), rien n’est en faute ; l’arrêt d’urgence reste le bouton rouge de la barre du robot. Le contrat a déjà arreterMission.' },
  { titre: 'Le workflow déplié', texte: 'Le chevron déplie, sous la barre, la mission dans le canevas de l’éditeur, en lecture : les états du tour, les fils pris, le temps de l’étape sous sa tuile, et la vue qui suit l’étape en cours. La barre reste au-dessus, le fil continue d’y courir.' },
  { titre: 'Lecture · pause · pas à pas', texte: 'Trois commandes, comme un débogueur, au bas du workflow déplié : ▶ joue en continu, ‖ met en pause, ⏭ joue une étape puis se remet en pause — le pas à pas, sans interrupteur de mode ; ▶ en sort. Une seule action est pleine à la fois, l’en-tête dit le mode. Il faudra au back : etapeSuivante(robotId), et Execution.pasAPas.' },
];

/** La barre et son workflow déplié, menés par une mission simulée. */
function Banc({ essai, vitesse }: { essai: MissionEssai; vitesse: number }) {
  const s = useScenario(essai, vitesse);
  const [developpe, setDeveloppe] = useState(true);
  return (
    <div className="bd-scene">
      <BarreFil l={s.lecture} pause={s.pause} acquitter={s.acquitter} arreter={s.arreter} developpe={developpe}
        basculer={() => setDeveloppe(!developpe)}>
        {developpe && (
          <Developpe l={s.lecture} mission={essai.mission} primitives={PRIMITIVES_ESSAI} pause={s.pause} etape={s.etape} arreter={s.arreter} />
        )}
      </BarreFil>
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
