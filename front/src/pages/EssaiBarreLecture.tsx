import { useState, type CSSProperties } from 'react';
import type { Mission } from '../api/types';
import { BarreFil } from '../components/lecture/BarreFil';
import { MISSIONS_ESSAI, useScenario } from '../components/lecture/scenario';

const LARGEURS = [
  { cle: 'ecran', libelle: 'Écran', px: 1200 },
  { cle: 'tablette', libelle: 'Tablette', px: 820 },
  { cle: 'etroit', libelle: 'Étroit', px: 600 },
] as const;

const VITESSES = [1, 3, 8];

/** Le système graphique de la barre : chaque état a une couleur, un signe et un mouvement, et rien d'autre ne les prend. */
const SYSTEME = [
  { couleur: '#e9eef7', signe: '●', nom: 'En cours · blanc', texte: 'Ce qui vit : le point respire, l’étape tourne, l’onde file sur le fil qui y mène.' },
  { couleur: '#8a93a3', signe: '‖', nom: 'En pause · gris', texte: 'Ce qui est suspendu : tout s’arrête, l’onde se fige et devient blanche. Rien d’alarmant.' },
  { couleur: '#3dff8a', signe: '✓', nom: 'Réussi · vert', texte: 'Une étape réussie, le fil « réussi » pris, la mission terminée. Jamais un bouton.' },
  { couleur: '#ffb02e', signe: '!', nom: 'Attention · ambre', texte: 'Une étape ratée et la branche « échec » qu’elle prend (fil pointillé), une mission échouée.' },
  { couleur: '#ff2d3a', signe: '■', nom: 'Danger · rouge', texte: 'L’arrêt d’urgence : la barre entière, l’étape arrêtée, plus rien ne bouge.' },
  { couleur: '#e9eef7', signe: '▶', nom: 'Action · blanc plein', texte: 'L’action principale (Reprendre) est pleine, la secondaire (Pause) en contour.', plein: true },
];

/** La barre menée par une mission simulée, et les gestes de l'opérateur sur elle. */
function Banc({ mission, vitesse, largeur }: { mission: Mission; vitesse: number; largeur: number }) {
  const s = useScenario(mission, vitesse);
  const l = s.lecture;
  const fini = l.etat === 'reussie' || l.etat === 'echouee';
  return (
    <>
      <div className="bl-commandes">
        <span className="essai-barre-sur">LA MISSION SIMULÉE</span>
        <button className="lm-bouton" onClick={s.pause} disabled={fini || l.etat === 'urgence'}>{l.etat === 'pause' ? 'Reprendre' : 'Pause'}</button>
        <button className="lm-bouton" onClick={s.rater} disabled={l.courant < 0 || l.etat === 'urgence'}>Faire rater l’étape en cours</button>
        {l.etat === 'urgence'
          ? <button className="lm-bouton" onClick={s.rearmer}>Réarmer</button>
          : <button className="lm-bouton bl-commande-urgence" onClick={s.urgence} disabled={fini}>Arrêt d’urgence</button>}
        <span className="bl-commandes-note">La prise rate seule au tour 2 ; à la fin, la mission repart au bout de 6 s.</span>
      </div>
      <div className="bl-scene" style={{ maxWidth: largeur }}><BarreFil l={l} pause={s.pause} /></div>
    </>
  );
}

/** La barre de la mission qui joue : le fil, sur le graphe de la mission (#/essai/barre-lecture). */
export function EssaiBarreLecture() {
  const [mission, setMission] = useState<keyof typeof MISSIONS_ESSAI>('longue');
  const [vitesse, setVitesse] = useState(3);
  const [largeur, setLargeur] = useState<(typeof LARGEURS)[number]['cle']>('ecran');
  return (
    <div className="lm-page fond-hud bl-page">
      <header className="lm-page-tete">
        <p className="essai-barre-sur">ESSAI · BARRE DE LECTURE</p>
        <span className="em-segment lm-choix">
          {(['longue', 'courte'] as const).map((m) => (
            <button key={m} className={mission === m ? 'actif' : ''} onClick={() => setMission(m)}>
              {m === 'longue' ? 'Mission longue · branche échec · ×3' : 'Mission courte · ×4'}
            </button>
          ))}
        </span>
        <span className="em-segment lm-choix">
          {VITESSES.map((v) => <button key={v} className={vitesse === v ? 'actif' : ''} onClick={() => setVitesse(v)}>×{v}</button>)}
        </span>
        <span className="em-segment lm-choix">
          {LARGEURS.map((x) => <button key={x.cle} className={largeur === x.cle ? 'actif' : ''} onClick={() => setLargeur(x.cle)}>{x.libelle}</button>)}
        </span>
        <p className="lm-idee">
          Le graphe de la mission tel que l’éditeur le dessine. Quand une étape finit, une étincelle part sur le fil que la
          mission a pris et la caméra la suit, en haut, en bas, en arrière, jusqu’à l’étape suivante, qui s’ouvre à son arrivée.
        </p>
      </header>
      <Banc key={mission} mission={MISSIONS_ESSAI[mission]} vitesse={vitesse} largeur={LARGEURS.find((x) => x.cle === largeur)!.px} />
      <h2 className="bl-titre">Le système graphique</h2>
      <div className="bl-systeme">
        {SYSTEME.map((x) => (
          <div key={x.nom}>
            <span className={`bl-signe ${x.plein ? 'bl-signe-plein' : ''}`} style={{ ['--c' as string]: x.couleur } as CSSProperties}>{x.signe}</span>
            <span><b>{x.nom}</b><span>{x.texte}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
