import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import type { EtatCapteurs, EtatCorps, Robot, Verdict } from '../api/types';
import { BarreRobot } from '../components/BarreRobot';
import { CALQUES } from '../components/calques';
import { BarreMission } from '../components/BarreMission';
import { FiltresCalques } from '../components/Filtres';
import { Demarrage } from '../components/Demarrage';
import { IntroLogo } from '../components/IntroLogo';
import { MiniCarte } from '../components/MiniCarte';
import { Reticule } from '../components/Reticule';
import { Overlay } from '../components/Overlay';
import { useCharge } from '../components/useCharge';
import { monterScene, type Calque, type Scene3D } from '../vue3d/scene';

const SANTE_MS = 2000;

/** Les écrans qu'on ouvre depuis l'accueil, dans le rail du côté droit. */
const RAIL = [
  { vers: '/primitives', libelle: 'Primitives', Icone: IconePrimitives },
  { vers: '/missions', libelle: 'Missions', Icone: IconeMissions },
];

function IconeMissions() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="5" cy="6" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="5" cy="18" r="2" /><path d="M7 6h5a3 3 0 0 1 3 3v1M7 18h5a3 3 0 0 0 3-3v-1" />
    </svg>
  );
}

function IconePrimitives() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M16.5 13.5v6M13.5 16.5h6" />
    </svg>
  );
}

/** Le verdict du robot : arrêt d'urgence ou moteur trop chaud / en défaut = problème ; hors ligne = inconnu. */
function verdictRobot(r: Robot | undefined, corps: EtatCorps | null): { verdict: Verdict; raison: string } {
  if (!r || r.etat === 'hors_ligne') return { verdict: 'inconnu', raison: 'robot hors ligne' };
  if (r.etat === 'arret_urgence') return { verdict: 'pb', raison: 'arrêt d’urgence' };
  const malades = corps?.moteurs.filter((m) => m.etat === 'trop_chaud' || m.etat === 'defaut') ?? [];
  if (malades.length) return { verdict: 'pb', raison: malades.map((m) => `${m.nom} ${m.etat === 'defaut' ? 'en défaut' : `${m.temperature}°`}`).join(' · ') };
  return { verdict: corps ? 'ok' : 'inconnu', raison: corps ? 'moteurs dans leurs seuils' : 'en attente de l’état des moteurs' };
}

export function Accueil() {
  const lieu = useLocation();
  const hote = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const [pret, setPret] = useState(false);
  const [nbObjets, setNbObjets] = useState(0);
  const [etape, setEtape] = useState<'bios' | 'logo' | 'pret'>('bios');
  const demarre = etape === 'pret';
  // 'sortie-camera' : le vol de retour, pendant lequel le HUD reste caché.
  const [plein, setPlein] = useState<null | 'carte' | 'camera' | 'sortie-camera'>(null);
  const [survolCamera, setSurvolCamera] = useState(false);
  const appui = useRef<{ x: number; y: number } | null>(null);
  // Par l'œil du robot : la scène et ses objets segmentés, ou la dernière image réelle s'il y en a une.
  const [apercu, setApercu] = useApercuCamera();
  const [imageReelle, setImageReelle] = useState(false);

  function survoler(e: React.PointerEvent) {
    const s = scene.current;
    if (!s || plein) return;
    const dessus = s.cibleSous(e.clientX, e.clientY) === 'camera';
    if (dessus !== survolCamera) {
      setSurvolCamera(dessus);
      s.survolerCamera(dessus);
    }
  }

  // Un clic, pas un glisser (le glisser fait tourner la vue) : on plonge dans l'écran de la caméra.
  function relacher(e: React.PointerEvent) {
    const a = appui.current;
    appui.current = null;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 5 || plein) return;
    if (scene.current?.cibleSous(e.clientX, e.clientY) === 'camera') {
      setSurvolCamera(false);
      setPlein('camera');
      scene.current.plongerCamera(true);
    }
  }

  const sortirCamera = useCallback(() => {
    setPlein('sortie-camera');
    scene.current?.plongerCamera(false).then(() => setPlein(null));
  }, []);

  useEffect(() => {
    if (plein !== 'camera') return;
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && sortirCamera();
    addEventListener('keydown', touche);
    return () => removeEventListener('keydown', touche);
  }, [plein, sortirCamera]);

  // Le HUD n'attend la fin du déploiement qu'à sa première apparition (index.css, .hud-pret).
  const [hudPret, setHudPret] = useState(false);
  useEffect(() => {
    if (!demarre) return;
    scene.current?.demarrer();
    const t = setTimeout(() => setHudPret(true), 3600);
    return () => clearTimeout(t);
  }, [demarre]);
  const [calques, setCalques] = useState<Record<Calque, boolean>>({ robot: true, atelier: true, camera: true, lidar: true, carte: true, objets: true, sol: true });
  const robots = useCharge(() => api.robots());
  // L'état du robot change sous nos yeux (arrêt d'urgence, mission) : le titre le relit comme la barre.
  const { recharger: relireRobots } = robots;
  useEffect(() => {
    const t = setInterval(relireRobots, 2000);
    return () => clearInterval(t);
  }, [relireRobots]);
  const robot = robots.donnee?.find((r) => r.etat === 'en_mission') ?? robots.donnee?.[0];
  const [sante, setSante] = useState<{ corps: EtatCorps | null; capteurs: EtatCapteurs | null }>({ corps: null, capteurs: null });
  useEffect(() => {
    if (!robot) return;
    let vivant = true;
    const lire = () => Promise.all([api.etatCorps(robot.id).catch(() => null), api.etatCapteurs(robot.id).catch(() => null)])
      .then(([corps, capteurs]) => vivant && setSante({ corps, capteurs }));
    lire();
    const t = setInterval(lire, SANTE_MS);
    return () => { vivant = false; clearInterval(t); };
  }, [robot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hote.current) return;
    const s = monterScene(hote.current);
    scene.current = s;
    s.pret.then(() => {
      setPret(true);
      setNbObjets(s.objets().length);
    });
    return () => s.detruire();
  }, []);

  function basculer(c: Calque) {
    const visible = !calques[c];
    setCalques({ ...calques, [c]: visible });
    scene.current?.afficher(c, visible);
  }

  return (
    <div className={`accueil ${demarre ? 'accueil-demarre' : ''} ${hudPret ? 'hud-pret' : ''} ${plein ? `plein-${plein}` : ''} ${robot ? 'avec-barre' : ''}`}>
      <div className={`accueil-scene ${survolCamera ? 'survol-camera' : ''}`} ref={hote} onPointerMove={survoler}
        onPointerDown={(e) => { appui.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={relacher} />
      <div className="accueil-vignette" aria-hidden="true" />

      <nav className="hud-rail" aria-label="Écrans">
        {RAIL.map(({ vers, libelle, Icone }) => (
          <NavLink key={vers} to={vers} className="hud-rail-lien">
            <span className="hud-rail-icone"><Icone /></span>
            <span className="hud-rail-nom">{libelle}</span>
          </NavLink>
        ))}
      </nav>



      <MiniCarte poste={robot?.posteCourant ?? null} plein={plein === 'carte'}
        basculer={(p) => setPlein(p ? 'carte' : null)} />

      {(plein === 'camera') && (
        <div className="vue-camera" aria-label="Vue de la caméra de tête">
          {apercu && imageReelle && (
            <>
              <img className="vue-camera-image" src="camera/apercu.jpg" alt="Dernière image de la caméra de tête"
                onError={() => setApercu(null)} />
              <p className="vue-camera-source">IMAGE D'ARCHIVE · {apercu}</p>
            </>
          )}
          {apercu && (
            <button className="hud-plein-fermer vue-camera-bascule" aria-pressed={imageReelle}
              onClick={() => setImageReelle(!imageReelle)}>
              {imageReelle ? 'OBJETS SEGMENTÉS' : 'IMAGE RÉELLE'}
            </button>
          )}
          <div className="vue-camera-coins" aria-hidden="true" />
          <p className="vue-camera-titre">CAMÉRA TÊTE · REALSENSE D435i · 87° × 58° · 30 i/s</p>
          <p className="vue-camera-rec"><span /> EN DIRECT</p>
          <button className="hud-plein-fermer" onClick={sortirCamera}>QUITTER LA CAMÉRA <span aria-hidden="true">⤡</span></button>
        </div>
      )}

      <FiltresCalques className="hud-calques" actifs={calques} basculer={basculer} fixes={['robot']}
        verdicts={{
          robot: verdictRobot(robot, sante.corps),
          camera: { verdict: sante.capteurs?.camera ?? 'inconnu', raison: '' },
          lidar: { verdict: sante.capteurs?.lidar ?? 'inconnu', raison: '' },
          objets: nbObjets ? { verdict: 'ok', raison: '' } : { verdict: 'inconnu', raison: 'aucun objet déclaré' },
          atelier: { verdict: pret ? 'ok' : 'inconnu', raison: '' },
        }}
        calques={CALQUES.map((c) => (c.cle === 'objets' && nbObjets ? { ...c, detail: `${nbObjets} ${c.detail}` } : c))} />

      {robot && <BarreRobot robotId={robot.id} forme="ile" />}
      {robot && <BarreMission robot={robot} />}

      {demarre && (
        <Reticule projeterSol={(x, y) => scene.current?.projeterSol(x, y) ?? null} cache={lieu.pathname.startsWith('/missions')}
          indice={(x, y) => (scene.current?.cibleSous(x, y) === 'camera' ? 'CLIC · PLEIN ÉCRAN CAMÉRA'
            : document.elementFromPoint(x, y)?.closest('.hud-carte-zone') ? 'CLIC · CARTE EN GRAND' : null)} />
      )}
      <Overlay />
      {etape === 'bios' && <Demarrage pret={pret} onFini={() => setEtape('logo')} />}
      {etape === 'logo' && <IntroLogo onFini={() => setEtape('pret')} />}
    </div>
  );
}


/** Le run de la dernière image réelle de la caméra de tête (scripts/copier-camera.mjs), ou null sans image. */
function useApercuCamera(): [string | null, (run: string | null) => void] {
  const [run, setRun] = useState<string | null>(null);
  useEffect(() => {
    fetch('camera/apercu.json').then((r) => r.json()).then((m: { run: string }) => setRun(m.run)).catch(() => setRun(null));
  }, []);
  return [run, setRun];
}
