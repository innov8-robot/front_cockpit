import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { nbPrimitives } from '../api/libelles';
import type { Execution, Mission, Primitive, Robot, Run } from '../api/types';
import { BarreFil } from './lecture/BarreFil';
import { lectureDirecte, lectureFinale } from './lecture/direct';

/** La barre se relit à cette période : la mission en cours et son chrono vivent. */
const RAFRAICHI_MS = 1000;
/** Une mission réussie reste affichée ce temps-là, puis la barre revient au lancement (ms). */
const SUCCES_MS = 6000;

/** La fin d'une mission : sa dernière exécution vue, et le run qui dit son issue. */
interface Fin { execution: Execution; run: Run }

/** Le dernier run terminé d'une mission. */
const dernierRun = (runs: Run[]) => runs.filter((u) => u.dureeS > 0).sort((a, b) => b.debut.localeCompare(a.debut))[0];

/**
 * La barre de mission, en haut de l'accueil. Au repos : choisir une mission prête et la lancer ; un robot qui n'est pas
 * disponible ne lance rien, et la barre dit pourquoi. Pendant une mission : le fil (components/lecture), son graphe
 * parcouru étape par étape. À la fin : son issue, un halo vert qui s'efface seul, ou rouge jusqu'à l'acquittement.
 */
export function BarreMission({ robot }: { robot: Robot }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [fin, setFin] = useState<Fin | null>(null);
  const [choix, setChoix] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [masquee, setMasquee] = useState<string | null>(null);
  const derniere = useRef<Execution | null>(null);

  useEffect(() => {
    api.primitives().then(setPrimitives).catch(() => undefined);
  }, []);

  useEffect(() => {
    let vivant = true;
    const lire = () => {
      api.missions().then((m) => vivant && setMissions(m)).catch(() => undefined);
      api.execution(robot.id).then((x) => {
        if (!vivant) return;
        const avant = derniere.current;
        derniere.current = x;
        setExecution(x);
        if (x) setFin(null);
        if (x || !avant) return;
        api.runs({ missionId: avant.missionId }).then((runs) => {
          const run = dernierRun(runs);
          if (vivant && run) setFin({ execution: avant, run });
        }).catch(() => undefined);
      }).catch(() => undefined);
    };
    lire();
    const t = setInterval(lire, RAFRAICHI_MS);
    return () => { vivant = false; clearInterval(t); };
  }, [robot.id]);

  useEffect(() => {
    if (fin?.run.issue !== 'reussi') return;
    const t = setTimeout(() => setFin(null), SUCCES_MS);
    return () => clearTimeout(t);
  }, [fin]);

  const jouables = missions.filter((m) => nbPrimitives(m) > 0);
  const choisie = choix || jouables[0]?.id || '';
  const disponible = robot.etat === 'disponible';
  const urgence = robot.etat === 'arret_urgence';
  const raison = urgence ? 'arrêt d’urgence engagé' : robot.etat === 'hors_ligne' ? 'robot hors ligne'
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

  const courante = execution && missions.find((m) => m.id === execution.missionId);
  if (execution && courante) {
    const l = lectureDirecte(courante, primitives, execution, urgence);
    const message = erreur ? { niveau: 'attention' as const, texte: erreur } : l.message?.texte === masquee ? null : l.message;
    return (
      <div className="barre-mission-fil">
        <BarreFil l={{ ...l, message }} lien={`/missions/${courante.id}?onglet=executions`}
          pause={() => !enCours && agir(api.pauseMission(robot.id, !execution.enPause))}
          acquitter={() => { setErreur(null); setMasquee(l.message?.texte ?? null); }} />
      </div>
    );
  }

  const finie = fin && missions.find((m) => m.id === fin.execution.missionId);
  const finale = fin && finie ? lectureFinale(lectureDirecte(finie, primitives, fin.execution, false), fin.run, urgence) : null;
  if (finale) {
    return (
      <div className="barre-mission-fil">
        <BarreFil l={finale} lien={`/missions/${finale.mission.id}?onglet=executions`} pause={() => undefined} acquitter={() => setFin(null)} />
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
        title={raison ? `Impossible : ${raison}` : undefined}
        onClick={() => { setFin(null); setMasquee(null); agir(api.lancerMission(choisie, robot.id)); }}>
        <span aria-hidden="true">▶</span> LANCER
      </button>
      {(raison || erreur) && <span className="barre-mission-erreur" role="alert">{erreur ?? raison}</span>}
    </div>
  );
}
