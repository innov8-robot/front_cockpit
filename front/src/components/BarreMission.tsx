import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Execution, Mission, Primitive, Robot, Run } from '../api/types';
import { BarreFil } from './lecture/BarreFil';
import { lectureDirecte, lectureFinale } from './lecture/direct';

/** La barre se relit à cette période : la mission en cours et son chrono vivent. */
const RAFRAICHI_MS = 1000;
/** Une mission réussie reste affichée ce temps-là, puis la barre s'efface (ms). */
const SUCCES_MS = 6000;

/** La fin d'une mission : sa dernière exécution vue, et le run qui dit son issue. */
interface Fin { execution: Execution; run: Run }

/** Le dernier run terminé d'une mission. */
const dernierRun = (runs: Run[]) => runs.filter((u) => u.dureeS > 0).sort((a, b) => b.debut.localeCompare(a.debut))[0];

/**
 * La barre de mission, en haut de l'accueil, seulement quand une mission joue : le fil (components/lecture), son graphe
 * parcouru étape par étape ; un clic ouvre son exécution sur l'étape touchée. À la fin : son issue, un halo vert qui
 * s'efface seul, ou rouge jusqu'à l'acquittement. Au repos, rien : on lance une mission depuis l'écran des missions.
 * Elle s'efface aussi quand l'éditeur d'une mission est ouvert.
 */
export function BarreMission({ robot }: { robot: Robot }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [primitives, setPrimitives] = useState<Primitive[]>([]);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [fin, setFin] = useState<Fin | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [masquee, setMasquee] = useState<string | null>(null);
  const derniere = useRef<Execution | null>(null);
  const naviguer = useNavigate();
  const { pathname } = useLocation();
  /** L'éditeur d'une mission la montre déjà : la barre s'efface tant qu'il est ouvert. */
  const editeurOuvert = /^\/missions\/(?!developpees$)[^/]+$/.test(pathname);

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
        if (x && !avant) setMasquee(null);
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

  const urgence = robot.etat === 'arret_urgence';

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

  if (editeurOuvert) return null;
  const courante = execution && missions.find((m) => m.id === execution.missionId);
  if (execution && courante) {
    const l = lectureDirecte(courante, primitives, execution, urgence);
    const message = erreur ? { niveau: 'attention' as const, texte: erreur } : l.message?.texte === masquee ? null : l.message;
    return (
      <div className="barre-mission-fil">
        <BarreFil l={{ ...l, message }} ouvrir={(noeud) => naviguer(`/missions/${courante.id}?onglet=executions${noeud ? `&noeud=${noeud}` : ''}`)}
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
        <BarreFil l={finale} ouvrir={() => naviguer(`/missions/${finale.mission.id}?onglet=executions`)} pause={() => undefined}
          acquitter={() => setFin(null)} />
      </div>
    );
  }

  return null;
}
