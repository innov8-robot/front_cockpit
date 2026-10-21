import { useMemo, useState, type PointerEvent } from 'react';
import { depuis } from '../../api/libelles';
import type { Mission, Primitive, Run } from '../../api/types';
import { ISSUES, causes, duree, nomEtape, quand, statsParEtape } from './donnees';
import { Issue } from './OngletExecutions';

/** Les périodes qu'on regarde, la plus courte d'abord. */
const PERIODES = [
  { cle: 'jour', libelle: '24 h', heures: 24 },
  { cle: 'semaine', libelle: '7 jours', heures: 24 * 7 },
  { cle: 'tout', libelle: 'Tout', heures: Infinity },
] as const;

/** Le début d'une période, en millisecondes : il y a `heures` heures. */
const debutPeriode = (heures: number) => Date.now() - heures * 3_600_000;

/** Le nombre de runs montrés dans la courbe des durées. */
const NB_COLONNES = 20;

/**
 * Les durées des derniers runs, une colonne chacun, du plus ancien au plus récent, de la couleur de son issue (et la
 * légende avec les icônes). Au survol d'une colonne : la durée, puis l'issue, la date et la cause.
 */
function Durees({ runs }: { runs: Run[] }) {
  const [survol, setSurvol] = useState<{ x: number; run: Run } | null>(null);
  const derniers = runs.slice(-NB_COLONNES);
  const max = Math.max(60, ...derniers.map((r) => r.dureeS));
  const haut = Math.ceil(max / 30) * 30;
  const graduations = Array.from({ length: haut / 30 + 1 }, (_, i) => i * 30);
  const montrer = (e: PointerEvent<HTMLElement>, run: Run) => {
    const boite = e.currentTarget.closest('.an-durees')!.getBoundingClientRect();
    setSurvol({ x: e.clientX - boite.left, run });
  };
  return (
    <div className="an-durees" onPointerLeave={() => setSurvol(null)}>
      <div className="an-legende">{(['reussi', 'echoue', 'interrompu'] as const).map((i) => <Issue key={i} issue={i} />)}</div>
      <div className="an-trace">
        {graduations.map((g) => (
          <div key={g} className="an-grille" style={{ bottom: `${(g / haut) * 100}%` }}><small>{g ? `${g} s` : '0'}</small></div>
        ))}
        <div className="an-colonnes">
          {derniers.map((r) => (
            <span key={r.id} className="an-cible" tabIndex={0} onPointerMove={(e) => montrer(e, r)}
              onFocus={(e) => setSurvol({ x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth, run: r })} onBlur={() => setSurvol(null)}
              aria-label={`${ISSUES[r.issue].libelle}, ${duree(r.dureeS)}, ${quand(r.debut)}`}>
              <i className={`an-colonne ex-barre-${r.issue}`} style={{ height: `${(r.dureeS / haut) * 100}%` }} />
            </span>
          ))}
        </div>
      </div>
      {survol && (
        <div className="ex-infobulle" style={{ left: survol.x + 12, top: 40 }} role="tooltip">
          <b>{duree(survol.run.dureeS)}</b>
          <span>{ISSUES[survol.run.issue].libelle} · {quand(survol.run.debut)}</span>
          {survol.run.cause && <span className="ex-infobulle-cause">{survol.run.cause}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * L'onglet Analyse : ce que les runs de la mission disent d'elle sur une période — la réussite, la réussite et la durée
 * de chaque étape (l'étape la plus fragile ressort), les causes d'échec, et la durée des derniers runs.
 */
export function OngletAnalyse({ m, primitives, runs }: { m: Mission; primitives: Primitive[]; runs: Run[] }) {
  const [periode, setPeriode] = useState<{ cle: (typeof PERIODES)[number]['cle']; depuisMs: number }>({ cle: 'tout', depuisMs: -Infinity });
  const choisir = (p: (typeof PERIODES)[number]) => setPeriode({ cle: p.cle, depuisMs: debutPeriode(p.heures) });
  const choisis = useMemo(() => runs
    .filter((r) => r.dureeS > 0 && new Date(r.debut).getTime() >= periode.depuisMs)
    .sort((a, b) => a.debut.localeCompare(b.debut)), [runs, periode]);
  const finis = choisis.filter((r) => r.issue !== 'interrompu');
  const reussis = finis.filter((r) => r.issue === 'reussi').length;
  const taux = finis.length ? reussis / finis.length : null;
  const etapes = statsParEtape(choisis);
  const fragile = etapes.filter((e) => e.joues >= 2 && e.reussis < e.joues).sort((a, b) => a.reussis / a.joues - b.reussis / b.joues)[0];
  const dureeMax = Math.max(1, ...etapes.map((e) => e.dureeMoyS));
  const lesCauses = causes(choisis);
  const causeMax = Math.max(1, ...lesCauses.map((c) => c.nombre));
  const dernierEchec = [...choisis].reverse().find((r) => r.issue === 'echoue');
  const moyenne = choisis.length ? choisis.reduce((s, r) => s + r.dureeS, 0) / choisis.length : null;

  return (
    <div className="an-onglet">
      <div className="an-filtres">
        <span>Période</span>
        <span className="lm-filtres">
          {PERIODES.map((p) => <button key={p.cle} className={periode.cle === p.cle ? 'actif' : ''} onClick={() => choisir(p)}>{p.libelle}</button>)}
        </span>
      </div>
      {choisis.length === 0 ? <p className="ex-rien">Aucun run sur cette période.</p> : <>
        <div className="an-tuiles">
          <div className="an-tuile an-tuile-heros">
            <span>Réussite</span>
            <b>{taux === null ? '—' : `${Math.round(taux * 100)} %`}</b>
            <small>{reussis} réussi{reussis > 1 ? 's' : ''} sur {finis.length} terminé{finis.length > 1 ? 's' : ''}</small>
          </div>
          <div className="an-tuile"><span>Exécutions</span><b>{choisis.length}</b>
            <small>{(['echoue', 'interrompu'] as const).map((i) => `${choisis.filter((r) => r.issue === i).length} ${ISSUES[i].libelle.toLowerCase()}${choisis.filter((r) => r.issue === i).length > 1 ? 's' : ''}`).join(' · ')}</small>
          </div>
          <div className="an-tuile"><span>Durée moyenne</span><b>{moyenne === null ? '—' : duree(moyenne)}</b><small>du lancement à la fin</small></div>
          <div className="an-tuile"><span>Dernier échec</span><b className="an-tuile-texte">{dernierEchec?.cause ?? 'aucun'}</b>
            <small>{dernierEchec ? depuis(dernierEchec.debut) : 'sur la période'}</small>
          </div>
        </div>

        <h3 className="ex-titre">Par étape</h3>
        <div className="an-table" role="table" aria-label="Réussite et durée par étape">
          <div className="an-ligne an-ligne-tete" role="row">
            <span role="columnheader">Étape</span><span role="columnheader">Réussite</span><span role="columnheader">Durée moyenne</span><span role="columnheader">Jouée</span>
          </div>
          {etapes.map((e) => {
            const t = e.reussis / e.joues;
            const faible = e === fragile;
            return (
              <div key={e.noeud} className={`an-ligne ${faible ? 'an-ligne-fragile' : ''}`} role="row">
                <span role="cell" className="an-etape">{nomEtape(m, primitives, e.noeud)}{faible && <em><i aria-hidden="true">!</i>la plus fragile</em>}</span>
                <span role="cell" className="an-mesure">
                  <span className="an-piste"><i className={faible ? 'an-fragile' : ''} style={{ width: `${t * 100}%` }} /></span>
                  <b>{Math.round(t * 100)} %</b>
                </span>
                <span role="cell" className="an-mesure">
                  <span className="an-piste"><i style={{ width: `${(e.dureeMoyS / dureeMax) * 100}%` }} /></span>
                  <b>{duree(e.dureeMoyS)}</b>
                </span>
                <span role="cell" className="an-joues">{e.joues}×</span>
              </div>
            );
          })}
        </div>

        <div className="an-deux">
          <section>
            <h3 className="ex-titre">Causes d’échec</h3>
            {lesCauses.length === 0 ? <p className="ex-rien">Aucun échec sur la période.</p> : (
              <div className="an-causes">
                {lesCauses.map((c) => (
                  <div key={c.cause} className="an-cause">
                    <Issue issue={c.issue} texte={false} />
                    <span className="an-cause-nom">{c.cause}</span>
                    <span className="an-piste"><i className={`ex-barre-${c.issue}`} style={{ width: `${(c.nombre / causeMax) * 100}%` }} /></span>
                    <b>{c.nombre}×</b>
                    <small>{depuis(c.derniere)}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3 className="ex-titre">Durée des derniers runs</h3>
            <Durees runs={choisis} />
          </section>
        </div>
      </>}
    </div>
  );
}
