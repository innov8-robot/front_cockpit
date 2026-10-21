import { useMemo, useState, type PointerEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EtapeRun, Execution, IssueRun, Mission, Primitive, Run } from '../../api/types';
import { depuis } from '../../api/libelles';
import { EditeurMission } from '../graphe/EditeurMission';
import { ISSUES, duree, nomEtape, pasAxe, quand, traceDe } from './donnees';

const ORDRE: IssueRun[] = ['reussi', 'echoue', 'interrompu'];

/** L'issue d'un run : son icône dans sa couleur, et son nom (jamais la couleur seule). */
export function Issue({ issue, texte = true }: { issue: IssueRun; texte?: boolean }) {
  return (
    <span className={`ex-issue ex-issue-${issue}`}>
      <i aria-hidden="true">{ISSUES[issue].icone}</i>{texte && ISSUES[issue].libelle}
    </span>
  );
}

interface Survol { x: number; y: number; etape: EtapeRun }

/**
 * La frise d'un run : une ligne par étape, sa barre posée sur l'axe du temps, sa durée et son issue en clair.
 * Au survol d'une barre, la durée d'abord, puis l'étape et la cause.
 */
function Frise({ run, m, primitives }: { run: Run; m: Mission; primitives: Primitive[] }) {
  const [survol, setSurvol] = useState<Survol | null>(null);
  const etapes = run.etapes ?? [];
  const total = Math.max(run.dureeS, 1);
  const pas = pasAxe(total);
  const graduations = Array.from({ length: Math.floor(total / pas) + 1 }, (_, i) => i * pas);
  const montrer = (e: PointerEvent<HTMLElement>, etape: EtapeRun) => {
    const boite = e.currentTarget.closest('.ex-frise')!.getBoundingClientRect();
    setSurvol({ x: e.clientX - boite.left, y: e.clientY - boite.top, etape });
  };
  if (!etapes.length) return <p className="ex-rien">Le détail par étape de ce run n’est pas disponible.</p>;
  return (
    <div className="ex-frise" onPointerLeave={() => setSurvol(null)}>
      {etapes.map((e) => (
        <div key={e.noeud + e.debutS} className="ex-frise-ligne">
          <Issue issue={e.issue} texte={false} />
          <span className="ex-frise-nom">{nomEtape(m, primitives, e.noeud)}</span>
          <span className="ex-piste">
            {graduations.map((g) => <i key={g} className="ex-graduation" style={{ left: `${(g / total) * 100}%` }} />)}
            <span className={`ex-barre ex-barre-${e.issue}`} tabIndex={0} aria-label={`${nomEtape(m, primitives, e.noeud)} : ${duree(e.dureeS)}, ${ISSUES[e.issue].libelle.toLowerCase()}`}
              style={{ left: `${(e.debutS / total) * 100}%`, width: `max(4px, ${(e.dureeS / total) * 100}%)` }}
              onPointerMove={(ev) => montrer(ev, e)} onFocus={(ev) => {
                const r = ev.currentTarget.getBoundingClientRect();
                const boite = ev.currentTarget.closest('.ex-frise')!.getBoundingClientRect();
                setSurvol({ x: r.right - boite.left, y: r.top - boite.top, etape: e });
              }} onBlur={() => setSurvol(null)} />
          </span>
          <span className="ex-frise-duree">{duree(e.dureeS)}</span>
        </div>
      ))}
      <div className="ex-frise-ligne ex-axe" aria-hidden="true">
        <span /><span />
        <span className="ex-piste">
          {graduations.map((g) => <small key={g} style={{ left: `${(g / total) * 100}%` }}>{g ? `${g} s` : '0'}</small>)}
        </span>
        <span />
      </div>
      {survol && (
        <div className="ex-infobulle" style={{ left: survol.x + 12, top: survol.y - 8 }} role="tooltip">
          <b>{duree(survol.etape.dureeS)}</b>
          <span>{nomEtape(m, primitives, survol.etape.noeud)}</span>
          <span>{ISSUES[survol.etape.issue].libelle} · à {duree(survol.etape.debutS)}</span>
          {survol.etape.cause && <span className="ex-infobulle-cause">{survol.etape.cause}</span>}
        </div>
      )}
    </div>
  );
}

interface Proprietes {
  m: Mission;
  primitives: Primitive[];
  runs: Run[];
  execution: Execution | null;
  voirEditeur(): void;
}

/**
 * L'onglet Exécutions, comme celui de n8n : à gauche les runs de la mission, du plus récent au plus ancien, avec leur
 * issue, leur durée et leur cause ; à droite le run choisi, rejoué sur le canevas, et sa frise d'étapes. Le nœud nommé
 * dans l'adresse (`?noeud=`, un clic dans la barre de lecture) est centré et mis en avant.
 */
export function OngletExecutions({ m, primitives, runs, execution, voirEditeur }: Proprietes) {
  const focus = useSearchParams()[0].get('noeud');
  const [filtre, setFiltre] = useState<IssueRun | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const finis = useMemo(() => runs.filter((r) => r.dureeS > 0).sort((a, b) => b.debut.localeCompare(a.debut)), [runs]);
  const visibles = finis.filter((r) => !filtre || r.issue === filtre);
  const enDirect = execution?.missionId === m.id ? execution : null;
  const direct = choisi === 'direct' ? enDirect : null;
  const run = direct ? null : visibles.find((r) => r.id === choisi) ?? (enDirect && !choisi ? null : visibles[0]);
  const montreDirect = Boolean(enDirect && (choisi === 'direct' || (!choisi && !run)));
  const trace = run ? traceDe(run, m) : null;
  const compte = (i: IssueRun) => finis.filter((r) => r.issue === i).length;
  const etapeCourante = enDirect ? enDirect.chemin[enDirect.etape] : null;

  return (
    <div className="ex-onglet">
      <aside className="ex-liste" aria-label="Exécutions de la mission">
        <div className="ex-filtres lm-filtres">
          <button className={filtre === null ? 'actif' : ''} onClick={() => setFiltre(null)}>Toutes <b>{finis.length}</b></button>
          {ORDRE.filter((i) => compte(i) > 0).map((i) => (
            <button key={i} className={filtre === i ? 'actif' : ''} onClick={() => setFiltre(filtre === i ? null : i)}>
              <Issue issue={i} texte={false} /><b>{compte(i)}</b>
            </button>
          ))}
        </div>
        <ul>
          {enDirect && (
            <li>
              <button className={`ex-run ex-run-direct ${montreDirect ? 'actif' : ''}`} onClick={() => setChoisi('direct')}>
                <span className="ex-run-haut"><span className="ex-direct"><i />En cours</span><span className="ex-run-duree">{duree(enDirect.dureeS)}</span></span>
                <span className="ex-run-bas">Étape {enDirect.etape}/{Math.max(1, enDirect.chemin.length - 1)}{etapeCourante && ` · ${nomEtape(m, primitives, etapeCourante)}`}</span>
              </button>
            </li>
          )}
          {visibles.map((r) => (
            <li key={r.id}>
              <button className={`ex-run ${!montreDirect && run?.id === r.id ? 'actif' : ''}`} onClick={() => setChoisi(r.id)}>
                <span className="ex-run-haut"><Issue issue={r.issue} /><span className="ex-run-duree">{duree(r.dureeS)}</span></span>
                <span className="ex-run-bas">{quand(r.debut)} · {depuis(r.debut)}</span>
                {r.cause && <span className={`ex-run-cause ex-cause-${r.issue}`}>{r.cause}</span>}
              </button>
            </li>
          ))}
          {!visibles.length && !enDirect && <li className="ex-rien">Aucune exécution.</li>}
        </ul>
      </aside>

      <section className="ex-detail">
        {montreDirect && enDirect ? (
          <>
            <header className="ex-detail-tete">
              <span className="ex-direct"><i />En cours</span>
              <span className="ex-detail-info">Étape {enDirect.etape}/{Math.max(1, enDirect.chemin.length - 1)} · {duree(enDirect.dureeS)}
                {enDirect.repetitions > 1 && ` · tour ${enDirect.repetition}/${enDirect.repetitions}`}</span>
            </header>
            <div className="ex-canevas">
              <EditeurMission key={`direct-${m.id}`} noeuds={m.noeuds} liens={m.liens} primitives={primitives} modifiable={false}
                execution={enDirect} focus={focus} onChange={() => undefined} />
            </div>
          </>
        ) : run ? (
          <>
            <header className="ex-detail-tete">
              <Issue issue={run.issue} />
              <span className="ex-detail-info">{quand(run.debut)} · {duree(run.dureeS)}</span>
              <span className="lm-espace" />
              <button className="lm-bouton" onClick={voirEditeur}>Modifier la mission</button>
            </header>
            {run.cause && (
              <p className={`ex-cause-bandeau ex-cause-${run.issue}`}>
                <b aria-hidden="true">{ISSUES[run.issue].icone}</b>
                {(() => {
                  const e = run.etapes?.find((x) => x.issue !== 'reussi');
                  return e ? <>Arrêtée à « {nomEtape(m, primitives, e.noeud)} » : {run.cause}</> : run.cause;
                })()}
              </p>
            )}
            <div className="ex-canevas">
              <EditeurMission key={`run-${run.id}`} noeuds={m.noeuds} liens={m.liens} primitives={primitives} modifiable={false}
                execution={null} trace={trace} focus={focus} onChange={() => undefined} />
            </div>
            <h3 className="ex-titre">Les étapes</h3>
            <Frise run={run} m={m} primitives={primitives} />
          </>
        ) : (
          <p className="ex-rien">Cette mission n’a pas encore été lancée.</p>
        )}
      </section>
    </div>
  );
}
