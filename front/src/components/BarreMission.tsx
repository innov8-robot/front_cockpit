import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { nbPrimitives } from '../api/libelles';
import { TYPES_PRIMITIVE } from '../api/libelles';
import type { Execution, Mission, Primitive, Robot } from '../api/types';
import { COULEURS_TYPE } from './graphe/NoeudPrimitive';

/** La barre se relit à cette période : la mission en cours et son chrono vivent. */
const RAFRAICHI_MS = 1000;

const chrono = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * La barre de mission, en bas de l'accueil : choisir une mission prête, la lancer, l'arrêter. Pendant une mission
 * elle dit laquelle, depuis quand ; un robot qui n'est pas disponible ne lance rien, et la barre dit pourquoi.
 */
export function BarreMission({ robot }: { robot: Robot }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [choix, setChoix] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.primitives().then(setPrimitives).catch(() => undefined);
  }, []);

  useEffect(() => {
    let vivant = true;
    const lire = () => {
      api.missions().then((m) => vivant && setMissions(m)).catch(() => undefined);
      api.execution(robot.id).then((x) => vivant && setExecution(x)).catch(() => undefined);
    };
    lire();
    const t = setInterval(lire, RAFRAICHI_MS);
    return () => { vivant = false; clearInterval(t); };
  }, [robot.id]);

  const jouables = missions.filter((m) => nbPrimitives(m) > 0);
  const courante = missions.find((m) => m.id === robot.missionCourante);
  const choisie = choix || jouables[0]?.id || '';
  const disponible = robot.etat === 'disponible';
  const raison = robot.etat === 'arret_urgence' ? 'arrêt d’urgence engagé' : robot.etat === 'hors_ligne' ? 'robot hors ligne'
    : robot.etat === 'en_charge' ? 'robot en charge' : null;

  async function agir(ordre: Promise<unknown>) {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await ordre;
      if (r && typeof r === 'object' && 'chemin' in r) setExecution(r as Execution);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  }

  if (courante && execution) {
    const pause = execution.enPause;
    return (
      <div className={`barre-mission en-cours ${pause ? 'en-pause' : ''}`} role="toolbar" aria-label={`Mission ${courante.nom}`}
        title={courante.nom}>
        <div className="barre-mission-textes">
          <small>{pause ? 'EN PAUSE' : 'EN COURS'} · <span className="nombre">{chrono(execution.dureeS)}</span>
            {execution.repetitions > 1 && <> · <span className="nombre">{execution.repetition}/{execution.repetitions}</span></>}
          </small>
        </div>
        <GrapheDirect mission={courante} execution={execution} primitives={primitives} />
        <button className={`barre-mission-pause ${pause ? 'reprendre' : ''}`} disabled={enCours}
          aria-label={pause ? 'Reprendre la mission' : 'Mettre la mission en pause'}
          onClick={() => agir(api.pauseMission(robot.id, !pause))}>
          {pause ? <IconeLecture /> : <IconePause />}
        </button>
        {erreur && <span className="barre-mission-erreur" role="alert">{erreur}</span>}
      </div>
    );
  }

  return (
    <div className="barre-mission" role="toolbar" aria-label="Mission">
      <div className="barre-mission-textes">
        <small>MISSION</small>
        {jouables.length ? (
          <select value={choisie} onChange={(e) => setChoix(e.target.value)} aria-label="Mission à lancer">
            {jouables.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        ) : (
          <Link to="/missions/nouvelle" className="barre-mission-vide">Aucune mission · en créer une</Link>
        )}
      </div>
      {choisie && (
        <Link to={`/missions/${choisie}`} className="barre-mission-ouvrir" title="Ouvrir la mission">ÉDITER</Link>
      )}
      <button className="barre-mission-lancer" disabled={!choisie || !disponible || enCours}
        title={raison ? `Impossible : ${raison}` : undefined} onClick={() => agir(api.lancerMission(choisie, robot.id))}>
        <span aria-hidden="true">▶</span> LANCER
      </button>
      {(raison || erreur) && <span className="barre-mission-erreur" role="alert">{erreur ?? raison}</span>}
    </div>
  );
}

/**
 * Le graphe de la mission en direct, à plat : les primitives du chemin joué, dans l'ordre. Celles qui sont faites
 * s'éteignent, celle qui se joue se remplit avec son avancement, les suivantes attendent.
 */
function GrapheDirect({ mission, execution, primitives }: { mission: Mission; execution: Execution; primitives: Primitive[] }) {
  const parId = new Map(primitives.map((p) => [p.id, p]));
  const etapes = execution.chemin.slice(1).map((id) => mission.noeuds.find((n) => n.id === id));
  return (
    <ol className="graphe-direct" aria-label="Avancement de la mission">
      {etapes.map((n, i) => {
        const p = n?.primitiveId ? parId.get(n.primitiveId) : undefined;
        const k = i + 1;
        const etat = k < execution.etape ? 'fait' : k === execution.etape ? 'courant' : 'a-venir';
        const couleur = p ? COULEURS_TYPE[p.type] : '#8a93a3';
        return (
          <li key={n?.id ?? i} className={`graphe-direct-etape ${etat}`} style={{ ['--couleur' as string]: couleur }}
            title={p ? `${TYPES_PRIMITIVE[p.type].libelle} · ${p.nom}` : undefined}>
            <span className="graphe-direct-pastille" aria-hidden="true">{etat === 'fait' ? '✓' : k}</span>
            <span className="graphe-direct-nom">{p?.nom ?? '—'}</span>
            {etat === 'courant' && (
              <span className="graphe-direct-jauge" aria-hidden="true">
                <span style={{ width: `${Math.round(execution.avancement * 100)}%` }} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function IconePause() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>;
}

function IconeLecture() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg>;
}
