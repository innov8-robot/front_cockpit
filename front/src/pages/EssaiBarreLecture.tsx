import { useState } from 'react';
import { BarreFil, BarreFrise, BarreTravelling } from '../components/lecture/Barres';
import { MISSIONS_ESSAI, useScenario } from '../components/lecture/scenario';
import type { Mission } from '../api/types';

const PROPOSITIONS = [
  {
    cle: 'a', nom: 'A · Le travelling', Barre: BarreTravelling,
    idee: 'La chaîne sur un rail, chaque étape nommée. La caméra glisse de nœud en nœud et garde l’étape en cours au tiers gauche : derrière ce qui est fait, devant ce qui vient, et dessous où part la mission si elle rate.',
  },
  {
    cle: 'b', nom: 'B · Le fil', Barre: BarreFil,
    idee: 'Les étapes en tuiles seules ; celle qui se joue s’ouvre au centre, son nom en grand. Dessous, un segment par étape du tour, comme des stories : il se refait quand la mission prend la branche « échec ».',
  },
  {
    cle: 'c', nom: 'C · La frise du temps', Barre: BarreFrise,
    idee: 'Chaque étape est aussi longue que sa durée ; la tête de lecture reste fixe et le temps défile dessous. Devant elle, les étapes prévues à leur durée moyenne : on voit ce qui reste et quand ça finit.',
  },
] as const;

const LARGEURS = [
  { cle: 'ecran', libelle: 'Écran', px: 1200 },
  { cle: 'tablette', libelle: 'Tablette', px: 820 },
  { cle: 'etroit', libelle: 'Étroit', px: 600 },
] as const;

const VITESSES = [1, 3, 8];

/** Les trois barres, menées par la même mission simulée : on les compare sur les mêmes instants. */
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
      {PROPOSITIONS.map(({ cle, nom, idee, Barre }) => (
        <section key={cle} className="bl-proposition">
          <h2>{nom}</h2>
          <p>{idee}</p>
          <div className="bl-scene" style={{ maxWidth: largeur }}><Barre l={l} pause={s.pause} /></div>
        </section>
      ))}
    </>
  );
}

/** Trois propositions pour la barre de la mission qui joue (#/essai/barre-lecture). */
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
      </header>
      <Banc key={mission} mission={MISSIONS_ESSAI[mission]} vitesse={vitesse} largeur={LARGEURS.find((x) => x.cle === largeur)!.px} />
    </div>
  );
}
