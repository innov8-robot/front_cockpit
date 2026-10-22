import type { Mission, Primitive } from '../../api/types';
import { duree } from '../executions/donnees';
import { EditeurMission } from '../graphe/EditeurMission';
import type { Trace } from '../graphe/correspondance';
import type { EtatNoeud } from '../missions/charte';
import type { Direct } from '../missions/Noeud';
import { BoutonStop, IconeLecture, IconePause } from './BarreFil';
import { etatsDuTour, type EtatFil } from './fil';
import type { Lecture } from './lecture';

/** L'état d'un nœud du fil, dans la langue du canevas de l'éditeur ; sans état, il n'est pas sur le chemin du tour. */
const VERS_CANEVAS: Record<EtatFil, EtatNoeud | undefined> = {
  ok: 'ok', echec: 'echec', cours: 'cours', pause: 'attente', danger: 'danger', erreur: 'danger', arrete: 'danger',
  approche: 'attente', prevu: 'attente', hors: undefined,
};

/** Le tour en cours, tel que le canevas de l'éditeur le dessine : les états, les fils pris, et ce qu'on lit sous les tuiles. */
function traceDe(l: Lecture): Trace {
  const e = etatsDuTour(l, true);
  const noeuds = new Map<string, EtatNoeud>();
  const directs = new Map<string, Direct>();
  for (const [id, etat] of e.noeuds) {
    const v = VERS_CANEVAS[etat];
    if (v) noeuds.set(id, v);
    if (etat === 'echec') directs.set(id, { texte: 'ratée', relance: true });
    if (etat === 'arrete') directs.set(id, { texte: 'arrêtée' });
  }
  const courant = l.courant >= 0 ? l.pas[l.courant].noeud : null;
  if (courant && l.dureeEtapeS !== null) {
    const texte = l.etat !== 'pause' ? duree(l.dureeEtapeS) : l.pasAPas && l.dureeEtapeS < 1 ? 'prochaine étape' : `en pause · ${duree(l.dureeEtapeS)}`;
    directs.set(courant, { texte });
  }
  return { noeuds, liens: e.liens, directs };
}

interface Proprietes {
  l: Lecture;
  mission: Mission;
  primitives: Primitive[];
  /** Pause, ou reprise. */
  pause(): void;
  /** Le mode pas à pas : la mission se met en pause à la fin de chaque étape. */
  basculerPasAPas(): void;
  /** En pas à pas, l'étape suivante, puis la pause. */
  etape(): void;
  arreter(): void;
  /** Replie le workflow : la mission continue. */
  fermer(): void;
  /** Ouvre l'exécution de la mission dans l'éditeur, s'il y a de quoi. */
  voirExecution?(): void;
}

/**
 * Le workflow déplié sous la barre : la mission dans le canevas de l'éditeur, en lecture, qui suit l'étape en cours ;
 * et les commandes de lecture, toutes de la même taille — stop à maintenir, lecture / pause, le mode pas à pas, et,
 * seulement dans ce mode, l'étape suivante. Une seule action est pleine à la fois.
 */
export function Developpe({ l, mission, primitives, pause, basculerPasAPas, etape, arreter, fermer, voirExecution }: Proprietes) {
  const fini = l.etat === 'reussie' || l.etat === 'erreur' || l.etat === 'arretee';
  const bloque = fini || l.etat === 'urgence';
  const enPause = l.etat === 'pause';
  const courant = l.courant >= 0 ? l.pas[l.courant].noeud : null;
  const nomCourant = l.mission.noeuds.find((n) => n.id === courant)?.nom;
  const legende = fini ? null : l.pasAPas ? (enPause ? 'Pas à pas · en attente' : 'Pas à pas · une étape') : enPause ? 'En pause' : 'En continu';
  return (
    <section className="bd-panneau" aria-label="Le workflow" onClick={(e) => e.stopPropagation()}>
      <header className="bd-tete">
        <span>Le workflow</span>
        {courant && <span className="bd-tete-etape">{nomCourant}</span>}
        <span className="lm-espace" />
        {legende && <span className={`bd-mode ${l.pasAPas ? 'bd-mode-pas' : ''}`} role="status">{legende}</span>}
        {voirExecution && <button className="lm-bouton bd-voir" onClick={voirExecution}>Voir l’exécution</button>}
        <button className="lm-carre bd-fermer" onClick={fermer} aria-label="Replier le workflow" title="Replier : la mission continue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <div className="bd-canevas">
        <EditeurMission key={mission.id} noeuds={mission.noeuds} liens={mission.liens} primitives={primitives} modifiable={false}
          execution={null} trace={traceDe(l)} focus={courant} onChange={() => undefined} />
        <div className="bd-transport" role="toolbar" aria-label="Commandes de lecture">
          <BoutonStop arreter={arreter} actif={!bloque} />
          <button className={`bl-bouton ${enPause && !l.pasAPas ? 'bl-principal' : ''}`} disabled={bloque} onClick={pause}
            aria-label={enPause ? 'Lecture' : 'Pause'} title={enPause ? 'Lecture' : 'Pause'}>
            {enPause ? <IconeLecture /> : <IconePause />}
          </button>
          <button className={`bl-bouton bd-mode-bouton ${l.pasAPas ? 'bd-actif' : ''}`} disabled={bloque} onClick={basculerPasAPas}
            aria-pressed={l.pasAPas} aria-label="Pas à pas" title={l.pasAPas ? 'Quitter le pas à pas' : 'Pas à pas : une pause à la fin de chaque étape'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19h5v-5h5V9h6" /></svg>
          </button>
          {l.pasAPas && (
            <button className={`bl-bouton bd-etape ${enPause ? 'bl-principal' : ''}`} disabled={bloque || !enPause} onClick={etape}
              aria-label="Étape suivante, puis pause" title="Étape suivante, puis pause">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l10 7-10 7z" fill="currentColor" /><rect x="16" y="5" width="3" height="14" rx="1" fill="currentColor" /></svg>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
