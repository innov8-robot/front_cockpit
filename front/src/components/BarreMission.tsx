import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { nbPrimitives } from '../api/libelles';
import type { Mission, Robot, Run } from '../api/types';

/** La barre se relit à cette période : la mission en cours et son chrono vivent. */
const RAFRAICHI_MS = 1000;

const chrono = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * La barre de mission, en bas de l'accueil : choisir une mission prête, la lancer, l'arrêter. Pendant une mission
 * elle dit laquelle, depuis quand ; un robot qui n'est pas disponible ne lance rien, et la barre dit pourquoi.
 */
export function BarreMission({ robot }: { robot: Robot }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [choix, setChoix] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(Date.now());

  useEffect(() => {
    let vivant = true;
    const lire = () => {
      api.missions().then((m) => vivant && setMissions(m)).catch(() => undefined);
      api.runs({ robotId: robot.id }).then((u) => vivant && setRun(u[0] ?? null)).catch(() => undefined);
      setMaintenant(Date.now());
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
      await ordre;
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  }

  if (courante) {
    const depuis = run && run.missionId === courante.id ? (maintenant - new Date(run.debut).getTime()) / 1000 : 0;
    return (
      <div className="barre-mission en-cours" role="toolbar" aria-label="Mission">
        <span className="barre-mission-voyant" aria-hidden="true" />
        <div className="barre-mission-textes">
          <small>MISSION EN COURS</small>
          <strong>{courante.nom}</strong>
        </div>
        <span className="barre-mission-chrono nombre">{chrono(depuis)}</span>
        <span className="barre-mission-detail nombre">{nbPrimitives(courante)} primitives · ×{courante.repetitions}</span>
        <button className="barre-mission-stop" disabled={enCours} onClick={() => agir(api.arreterMission(robot.id))}>
          <span aria-hidden="true">■</span> STOP
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
