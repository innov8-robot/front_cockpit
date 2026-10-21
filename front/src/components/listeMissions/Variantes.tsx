import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ETATS_MISSION, ISSUES_RUN, depuis } from '../../api/libelles';
import type { EtatMission, Execution, Primitive, Robot } from '../../api/types';
import { EditeurMission } from '../graphe/EditeurMission';
import { chrono, etatDe, type Resume } from './donnees';
import { BandeRuns, Chiffres, Gestes, MiniChaine, MiniGraphe, PointEtat, Progression } from './Pieces';

/** Ce que chaque proposition reçoit : les missions résumées, le robot, la mission en cours, et de quoi relire. */
export interface ProprietesListe {
  resumes: Resume[];
  primitives: Primitive[];
  robot: Robot | null;
  execution: Execution | null;
  relire(): void;
  /** Le passage entre la liste (panneau de côté) et la vue développée (écran entier), à côté du titre. */
  bascule?: { vers: string; developpee: boolean };
}

/** Développer la liste en vue entière, ou la replier en panneau. */
function Bascule({ vers, developpee }: { vers: string; developpee: boolean }) {
  return (
    <Link className="lm-bascule" to={vers} title={developpee ? 'Replier en liste' : 'Développer'} aria-label={developpee ? 'Replier en liste' : 'Développer'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={developpee ? 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7' : 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'} />
      </svg>
    </Link>
  );
}

const ORDRE: EtatMission[] = ['en_cours', 'prete', 'echouee', 'brouillon', 'terminee'];

/** Les gestes partagés : lancer une mission, mettre en pause ou reprendre celle qui joue. */
function useGestes({ robot, execution, relire }: ProprietesListe) {
  return {
    peutLancer: (r: Resume) => robot?.etat === 'disponible' && r.chaine.length > 0,
    lancer: (r: Resume) => robot && api.lancerMission(r.mission.id, robot.id).then(relire).catch(() => undefined),
    pause: () => robot && execution && api.pauseMission(robot.id, !execution.enPause).then(relire).catch(() => undefined),
  };
}

/** La tête d'une liste : le titre, une recherche, les filtres par état, et « Nouvelle mission » (blanc, pas rouge). */
function Tete({ resumes, execution, cherche, setCherche, filtre, setFiltre, bascule }: {
  resumes: Resume[]; execution: Execution | null; cherche: string; setCherche(s: string): void; filtre: EtatMission | null; setFiltre(f: EtatMission | null): void;
  bascule?: ProprietesListe['bascule'];
}) {
  const compte = (e: EtatMission) => resumes.filter((r) => etatDe(r, execution) === e).length;
  return (
    <header className="lm-tete">
      <div className="lm-tete-ligne">
        <h2>Missions <span>{resumes.length}</span>{bascule && <Bascule {...bascule} />}</h2>
        <Link className="lm-nouvelle" to="/missions/nouvelle">+ Nouvelle mission</Link>
      </div>
      <div className="lm-tete-ligne">
        <input className="lm-recherche" placeholder="Chercher une mission…" value={cherche} onChange={(e) => setCherche(e.target.value)} />
        <span className="lm-filtres">
          <button className={filtre === null ? 'actif' : ''} onClick={() => setFiltre(null)}>Toutes</button>
          {ORDRE.filter((e) => compte(e) > 0).map((e) => (
            <button key={e} className={filtre === e ? 'actif' : ''} onClick={() => setFiltre(filtre === e ? null : e)}>
              <PointEtat etat={e} texte={false} />{ETATS_MISSION[e].libelle} <b>{compte(e)}</b>
            </button>
          ))}
        </span>
      </div>
    </header>
  );
}

/** Les missions à montrer : filtrées, cherchées, la mission en cours d'abord, puis par état et par fraîcheur. */
function useFiltre(resumes: Resume[], execution: Execution | null) {
  const [cherche, setCherche] = useState('');
  const [filtre, setFiltre] = useState<EtatMission | null>(null);
  const visibles = resumes
    .filter((r) => (!filtre || etatDe(r, execution) === filtre) && r.mission.nom.toLowerCase().includes(cherche.toLowerCase()))
    .sort((a, b) => ORDRE.indexOf(etatDe(a, execution)) - ORDRE.indexOf(etatDe(b, execution)) || b.mission.modifieeLe.localeCompare(a.mission.modifieeLe));
  return { cherche, setCherche, filtre, setFiltre, visibles };
}

/**
 * A · La liste vivante, pour le panneau de côté : une ligne par mission, avec sa chaîne de primitives en tuiles, ses
 * derniers runs et ses chiffres ; Lancer et Éditer au survol ; la mission qui joue montre son étape et sa pause.
 */
export function ListeVivante(props: ProprietesListe) {
  const { resumes, execution } = props;
  const f = useFiltre(resumes, execution);
  const g = useGestes(props);
  return (
    <div className="lm-liste">
      <Tete resumes={resumes} execution={execution} bascule={props.bascule} {...f} />
      <ul>
        {f.visibles.map((r) => {
          const etat = etatDe(r, execution);
          const joue = etat === 'en_cours' && execution ? execution : null;
          return (
            <li key={r.mission.id} className={`lm-ligne ${joue ? 'lm-ligne-cours' : ''}`}>
              <div className="lm-ligne-haut">
                <PointEtat etat={etat} texte={false} />
                <Link className="lm-nom" to={`/missions/${r.mission.id}`}>{r.mission.nom}</Link>
                {!joue && <Gestes m={r.mission} peutLancer={g.peutLancer(r)} lancer={() => g.lancer(r)} />}
              </div>
              <MiniChaine r={r} execution={execution} />
              {joue ? <Progression r={r} execution={joue} pause={g.pause} /> : (
                <div className="lm-ligne-bas"><BandeRuns r={r} /><Chiffres r={r} /></div>
              )}
            </li>
          );
        })}
      </ul>
      {f.visibles.length === 0 && <p className="lm-rien">Aucune mission ne correspond.</p>}
    </div>
  );
}

/** B · Les cartes, pour l'écran entier : chaque mission montre son graphe en miniature, ses runs et ses chiffres. */
export function Cartes(props: ProprietesListe) {
  const { resumes, primitives, execution } = props;
  const f = useFiltre(resumes, execution);
  const g = useGestes(props);
  return (
    <div className="lm-liste">
      <Tete resumes={resumes} execution={execution} bascule={props.bascule} {...f} />
      <div className="lm-cartes">
        {f.visibles.map((r) => {
          const etat = etatDe(r, execution);
          const joue = etat === 'en_cours' && execution ? execution : null;
          return (
            <article key={r.mission.id} className={`lm-carte ${joue ? 'lm-ligne-cours' : ''}`}>
              <Link to={`/missions/${r.mission.id}`} className="lm-carte-apercu" aria-label={`Ouvrir ${r.mission.nom}`}>
                <MiniGraphe m={r.mission} primitives={primitives} execution={execution} />
              </Link>
              <div className="lm-carte-corps">
                <div className="lm-ligne-haut"><PointEtat etat={etat} /><span className="lm-espace" />{r.dernier && <small>{depuis(r.dernier.debut)}</small>}</div>
                <h3>{r.mission.nom}</h3>
                {joue ? <Progression r={r} execution={joue} pause={g.pause} /> : <>
                  <div className="lm-ligne-bas"><BandeRuns r={r} /><Chiffres r={r} /></div>
                  <Gestes m={r.mission} peutLancer={g.peutLancer(r)} lancer={() => g.lancer(r)} />
                </>}
              </div>
            </article>
          );
        })}
        <Link to="/missions/nouvelle" className="lm-carte lm-carte-nouvelle"><span>+</span>Nouvelle mission</Link>
      </div>
    </div>
  );
}

/**
 * C · La liste et l'aperçu : à gauche les missions, serrées ; à droite celle qu'on a choisie, son graphe tel que
 * l'éditeur le dessine (en lecture), ses derniers runs avec leur cause, et ses gestes.
 */
export function ListeApercu(props: ProprietesListe) {
  const { resumes, primitives, execution } = props;
  const f = useFiltre(resumes, execution);
  const g = useGestes(props);
  const [choisie, setChoisie] = useState<string | null>(null);
  const r = f.visibles.find((x) => x.mission.id === choisie) ?? f.visibles[0];
  const joue = r && etatDe(r, execution) === 'en_cours' && execution ? execution : null;
  return (
    <div className="lm-liste lm-apercu">
      <Tete resumes={resumes} execution={execution} bascule={props.bascule} {...f} />
      <div className="lm-apercu-corps">
        <ul className="lm-apercu-liste">
          {f.visibles.map((x) => (
            <li key={x.mission.id}>
              <button className={x === r ? 'actif' : ''} onClick={() => setChoisie(x.mission.id)}>
                <PointEtat etat={etatDe(x, execution)} texte={false} />
                <span className="lm-nom">{x.mission.nom}</span>
                <small>{x.taux === null ? '—' : `${Math.round(x.taux * 100)} %`}</small>
              </button>
            </li>
          ))}
        </ul>
        {r && (
          <section className="lm-detail">
            <div className="lm-ligne-haut">
              <PointEtat etat={etatDe(r, execution)} />
              <h3>{r.mission.nom}</h3>
              {!joue && <Gestes m={r.mission} peutLancer={g.peutLancer(r)} lancer={() => g.lancer(r)} />}
            </div>
            {r.mission.description && <p className="lm-description">{r.mission.description}</p>}
            {joue && <Progression r={r} execution={joue} pause={g.pause} />}
            <div className="lm-detail-graphe">
              <EditeurMission key={r.mission.id} noeuds={r.mission.noeuds} liens={r.mission.liens} primitives={primitives}
                modifiable={false} execution={joue} onChange={() => undefined} />
            </div>
            <div className="lm-ligne-bas"><BandeRuns r={r} /><Chiffres r={r} /></div>
            <ul className="lm-historique">
              {[...r.runs].reverse().slice(0, 4).map((u) => (
                <li key={u.id}>
                  <i className={`lm-run-${u.issue}`} />
                  <span>{ISSUES_RUN[u.issue].libelle}</span>
                  <span className="lm-cause">{u.cause ?? ''}</span>
                  <span>{chrono(u.dureeS)}</span>
                  <small>{depuis(u.debut)}</small>
                </li>
              ))}
              {r.runs.length === 0 && <li className="lm-rien">Jamais lancée.</li>}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
