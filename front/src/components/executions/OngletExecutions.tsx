import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EtapeRun, Execution, IssueRun, Mission, Primitive, Run } from '../../api/types';
import { depuis } from '../../api/libelles';
import { EditeurMission } from '../graphe/EditeurMission';
import { lectureDirecte } from '../lecture/direct';
import { etapesDe } from '../lecture/fil';
import { ISSUES, duree, nomEtape, pasAxe, quand, traceDe } from './donnees';
import type { EntreeJournal } from './journal';

const ORDRE: IssueRun[] = ['reussi', 'echoue', 'interrompu'];

/** L'issue d'un run : son icône dans sa couleur, et son nom (jamais la couleur seule). */
export function Issue({ issue, texte = true }: { issue: IssueRun; texte?: boolean }) {
  return (
    <span className={`ex-issue ex-issue-${issue}`}>
      <i aria-hidden="true">{ISSUES[issue].icone}</i>{texte && ISSUES[issue].libelle}
    </span>
  );
}

/** Une étape sur la frise : jouée, avec son issue, ou en cours. */
type EtapeFrise = Omit<EtapeRun, 'issue'> & { issue: IssueRun | 'cours' };

interface Survol { x: number; y: number; etape: EtapeFrise }

/** L'icône d'une étape de la frise : celle de son issue, ou le rond d'une étape en cours. */
function IssueEtape({ issue }: { issue: EtapeFrise['issue'] }) {
  if (issue !== 'cours') return <Issue issue={issue} texte={false} />;
  return <span className="ex-issue ex-issue-cours"><i aria-hidden="true">◌</i></span>;
}

const libelleEtape = (issue: EtapeFrise['issue']) => (issue === 'cours' ? 'En cours' : ISSUES[issue].libelle);

/**
 * La frise d'un run, ou de la mission qui joue : une ligne par étape, sa barre posée sur l'axe du temps, sa durée et
 * son issue en clair ; l'étape en cours grandit. Au survol d'une barre, la durée d'abord, puis l'étape et la cause.
 */
function Frise({ etapes, totalS, m, primitives, etroite }: { etapes: EtapeFrise[]; totalS: number; m: Mission; primitives: Primitive[]; etroite?: boolean }) {
  const [survol, setSurvol] = useState<Survol | null>(null);
  const total = Math.max(totalS, 1);
  const pas = pasAxe(total, etroite ? 3 : 6);
  const graduations = Array.from({ length: Math.floor(total / pas) + 1 }, (_, i) => i * pas);
  const montrer = (e: PointerEvent<HTMLElement>, etape: EtapeFrise) => {
    const boite = e.currentTarget.closest('.ex-frise')!.getBoundingClientRect();
    setSurvol({ x: e.clientX - boite.left, y: e.clientY - boite.top, etape });
  };
  return (
    <div className="ex-frise" onPointerLeave={() => setSurvol(null)}>
      {etapes.map((e) => (
        <div key={e.noeud + e.debutS} className="ex-frise-ligne">
          <IssueEtape issue={e.issue} />
          <span className="ex-frise-nom">{nomEtape(m, primitives, e.noeud)}</span>
          <span className="ex-piste">
            {graduations.map((g) => <i key={g} className="ex-graduation" style={{ left: `${(g / total) * 100}%` }} />)}
            <span className={`ex-barre ex-barre-${e.issue}`} tabIndex={0} aria-label={`${nomEtape(m, primitives, e.noeud)} : ${duree(e.dureeS)}, ${libelleEtape(e.issue).toLowerCase()}`}
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
          <span>{libelleEtape(survol.etape.issue)} · à {duree(survol.etape.debutS)}</span>
          {survol.etape.cause && <span className="ex-infobulle-cause">{survol.etape.cause}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Les étapes du tour en cours de la mission qui joue, pour la frise : chacune depuis son début jusqu'au début de la
 * suivante, celle en cours jusqu'à maintenant. Sans heures de début, pas de frise.
 */
function etapesEnDirect(x: Execution): { etapes: EtapeFrise[]; totalS: number } | null {
  const joues = x.joues ?? [];
  if (!joues.length || joues.some((j) => j.debutS === undefined)) return null;
  const t0 = joues[0].debutS!;
  const etapes = joues.map((j, i) => {
    const debutS = j.debutS! - t0;
    return { noeud: j.noeud, debutS, dureeS: Math.max(0, (joues[i + 1]?.debutS ?? x.dureeS) - t0 - debutS), issue: j.issue, cause: null };
  });
  return { etapes, totalS: x.dureeS - t0 };
}

/** Le signe d'une ligne du journal : son trait d'arbre (début et fin d'étape), et son icône. */
function signes(e: EntreeJournal): [string, string] {
  switch (e.sorte) {
    case 'debut': return ['┌', ''];
    case 'fin': return ['└', e.ton === 'ok' ? '✓' : '!'];
    case 'alerte': return ['│', '!'];
    case 'pause': return ['│', '‖'];
    case 'reprise': return ['│', '▶'];
    case 'pasapas': return ['│', '⇥'];
    case 'tour': return ['', '↻'];
    case 'lancement': return ['', '▶'];
    case 'issue': return ['', e.ton === 'ok' ? '✓' : '■'];
  }
}

/** Une boîte qui défile et descend d'elle-même à chaque nouvelle ligne (`compte`) : la frise en direct. */
function DefileBas({ compte, children }: { compte: number; children: ReactNode }) {
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = boite.current;
    if (b) b.scrollTop = b.scrollHeight;
  }, [compte]);
  return <div className="ex-defile" ref={boite}>{children}</div>;
}

/**
 * Le journal de la mission, comme la console du cockpit : une ligne par événement, le temps joué, l'arbre de chaque
 * étape (son début, ce qui s'y passe, sa fin et la sortie prise). Il descend tout seul vers la dernière ligne.
 */
function Journal({ entrees }: { entrees: EntreeJournal[] }) {
  const liste = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const l = liste.current;
    if (l) l.scrollTop = l.scrollHeight;
  }, [entrees.length]);
  if (!entrees.length) return <p className="ex-rien">Le journal commence à la prochaine relecture de la mission.</p>;
  return (
    <ol className="ex-journal" ref={liste} aria-live="polite" aria-label="Journal de la mission">
      {entrees.map((e) => {
        const [arbre, icone] = signes(e);
        return (
          <li key={e.id} className={`ex-j ex-j-${e.sorte} ex-j-${e.ton}`}>
            <time>{duree(e.t)}</time>
            <span className="ex-j-arbre" aria-hidden="true">{arbre}</span>
            <b className="ex-j-icone" aria-hidden="true">{icone}</b>
            <span className="ex-j-texte">{e.texte}</span>
            {e.detail && <span className="ex-j-detail">{e.detail}</span>}
          </li>
        );
      })}
    </ol>
  );
}

interface Proprietes {
  m: Mission;
  primitives: Primitive[];
  runs: Run[];
  execution: Execution | null;
  /** Le journal de la mission qui joue (ou qui vient de finir), tenu par la page de la mission. */
  journal: EntreeJournal[];
  voirEditeur(): void;
}

/**
 * L'onglet Exécutions, comme celui de n8n : à gauche les runs de la mission, du plus récent au plus ancien, avec leur
 * issue, leur durée et leur cause ; à droite le run choisi, rejoué sur le canevas, et sa frise d'étapes. Le nœud nommé
 * dans l'adresse (`?noeud=`, un clic dans la barre de lecture) est centré et mis en avant.
 */
export function OngletExecutions({ m, primitives, runs, execution, journal, voirEditeur }: Proprietes) {
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
                execution={enDirect} focus={focus} parcours={etapesDe(lectureDirecte(m, primitives, enDirect, false))} onChange={() => undefined} />
            </div>
            <div className="ex-direct-bas">
              <section>
                <h3 className="ex-titre">Le journal <span className="ex-direct ex-direct-titre"><i />en direct</span></h3>
                <Journal entrees={journal} />
              </section>
              <section>
                <h3 className="ex-titre">Les étapes
                  {enDirect.repetitions > 1 && <span className="ex-titre-tour"> · tour {enDirect.repetition}/{enDirect.repetitions}</span>}</h3>
                {(() => {
                  const f = etapesEnDirect(enDirect);
                  return f ? <DefileBas compte={f.etapes.length}><Frise etapes={f.etapes} totalS={f.totalS} m={m} primitives={primitives} etroite /></DefileBas>
                    : <p className="ex-rien">Le robot ne donne pas encore l’heure de ses étapes : pas de frise en direct.</p>;
                })()}
              </section>
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
            {(() => {
              const avecJournal = run.id === finis[0]?.id && journal.at(-1)?.sorte === 'issue';
              const frise = run.etapes?.length ? <Frise etapes={run.etapes} totalS={run.dureeS} m={m} primitives={primitives} etroite={avecJournal} />
                : <p className="ex-rien">Le détail par étape de ce run n’est pas disponible.</p>;
              if (!avecJournal) return <><h3 className="ex-titre">Les étapes</h3>{frise}</>;
              return (
                <div className="ex-direct-bas">
                  <section><h3 className="ex-titre">Le journal</h3><Journal entrees={journal} /></section>
                  <section><h3 className="ex-titre">Les étapes</h3><div className="ex-defile">{frise}</div></section>
                </div>
              );
            })()}
          </>
        ) : (
          <p className="ex-rien">Cette mission n’a pas encore été lancée.</p>
        )}
      </section>
    </div>
  );
}
