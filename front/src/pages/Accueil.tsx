import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, enSimulation } from '../api/client';
import { ETATS_ROBOT } from '../api/libelles';
import { reinitialiserSimulation } from '../api/mock';
import { Demarrage } from '../components/Demarrage';
import { IntroLogo } from '../components/IntroLogo';
import { MiniCarte } from '../components/MiniCarte';
import { Reticule } from '../components/Reticule';
import { Overlay } from '../components/Overlay';
import { useCharge } from '../components/useCharge';
import { monterScene, type Calque, type Scene3D } from '../vue3d/scene';

const CALQUES: { cle: Calque; libelle: string; detail: string }[] = [
  { cle: 'robot', libelle: 'Robot', detail: 'G1-D' },
  { cle: 'atelier', libelle: 'Atelier', detail: 'simulé' },
  { cle: 'camera', libelle: 'Caméra', detail: 'RGBD · 30 i/s' },
  { cle: 'lidar', libelle: 'Lidar', detail: '360° · 200 k pts/s' },
  { cle: 'sol', libelle: 'Grille', detail: '1 m' },
];

function heure(): string {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function Accueil() {
  const hote = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const [pret, setPret] = useState(false);
  const [etape, setEtape] = useState<'bios' | 'logo' | 'pret'>('bios');
  const demarre = etape === 'pret';
  // 'sortie-camera' : le vol de retour, pendant lequel le HUD reste caché.
  const [plein, setPlein] = useState<null | 'carte' | 'camera' | 'sortie-camera'>(null);
  const [survolCamera, setSurvolCamera] = useState(false);
  const appui = useRef<{ x: number; y: number } | null>(null);

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
  const [calques, setCalques] = useState<Record<Calque, boolean>>({ robot: true, atelier: true, camera: true, lidar: true, sol: true });
  const [maintenant, setMaintenant] = useState(heure);
  const robots = useCharge(() => api.robots());
  const robot = robots.donnee?.find((r) => r.etat === 'en_mission') ?? robots.donnee?.[0];

  useEffect(() => {
    if (!hote.current) return;
    const s = monterScene(hote.current);
    scene.current = s;
    s.pret.then(() => setPret(true));
    return () => s.detruire();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setMaintenant(heure()), 10_000);
    return () => clearInterval(t);
  }, []);

  function basculer(c: Calque) {
    const visible = !calques[c];
    setCalques({ ...calques, [c]: visible });
    scene.current?.afficher(c, visible);
  }

  return (
    <div className={`accueil ${demarre ? 'accueil-demarre' : ''} ${hudPret ? 'hud-pret' : ''} ${plein ? `plein-${plein}` : ''}`}>
      <div className={`accueil-scene ${survolCamera ? 'survol-camera' : ''}`} ref={hote} onPointerMove={survoler}
        onPointerDown={(e) => { appui.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={relacher} />
      <div className="accueil-vignette" aria-hidden="true" />

      <header className="hud-haut">
        <div className="hud-marque">ROBOTIQUE</div>
        <nav className="hud-nav">
          <NavLink to="/" end>Robot</NavLink>
          <NavLink to="/flotte">Flotte</NavLink>
          <NavLink to="/missions">Missions</NavLink>
          <NavLink to="/primitives">Primitives</NavLink>
        </nav>
        {enSimulation && (
          <button className="hud-simulation" title="Réinitialiser les données simulées"
            onClick={() => { reinitialiserSimulation(); location.reload(); }}>SIMULATION</button>
        )}
        <div className="hud-heure nombre">{maintenant}</div>
      </header>

      <section className="hud-titre">
        <p className="hud-sur">{robot ? `${robot.site} · ${robot.modele}` : ' '}</p>
        <h1>{robot?.nom ?? 'G1-D'}</h1>
        {robot && (
          <p className="hud-etat">
            <span className={`hud-point hud-${ETATS_ROBOT[robot.etat].ton}`} />
            {ETATS_ROBOT[robot.etat].libelle}
            {robot.posteCourant && <span className="hud-discret"> · poste {robot.posteCourant}</span>}
          </p>
        )}
      </section>

      {robot && (
        <aside className="hud-jauges" aria-label="Télémétrie">
          <Jauge libelle="BAT" valeur={robot.batterie} />
          <Jauge libelle="SIG" valeur={robot.etat === 'hors_ligne' ? 0 : 86} />
          <div className="hud-console nombre">
            <span>[LIDAR....]</span>
            <span className="hud-vert">[......OK]</span>
            <span>[RGBD.....]</span>
            <span className="hud-vert">[......OK]</span>
          </div>
        </aside>
      )}


      <MiniCarte poste={robot?.posteCourant ?? null} plein={plein === 'carte'}
        basculer={(p) => setPlein(p ? 'carte' : null)} />

      {(plein === 'camera') && (
        <div className="vue-camera" aria-label="Vue de la caméra de tête">
          <div className="vue-camera-coins" aria-hidden="true" />
          <p className="vue-camera-titre">CAMÉRA TÊTE · REALSENSE D435i · 87° × 58° · 30 i/s</p>
          <p className="vue-camera-rec"><span /> EN DIRECT</p>
          <button className="hud-plein-fermer" onClick={sortirCamera}>QUITTER LA CAMÉRA <span aria-hidden="true">⤡</span></button>
        </div>
      )}

      <footer className="hud-bas">
        {CALQUES.map((c) => (
          <button key={c.cle} className={`hud-calque ${calques[c.cle] ? 'actif' : ''}`}
            aria-pressed={calques[c.cle]} onClick={() => basculer(c.cle)}>
            <span className="hud-calque-nom">{c.libelle}</span>
            <span className="hud-calque-detail">{c.detail}</span>
          </button>
        ))}
      </footer>

      {demarre && (
        <Reticule projeterSol={(x, y) => scene.current?.projeterSol(x, y) ?? null}
          indice={(x, y) => (scene.current?.cibleSous(x, y) === 'camera' ? 'CLIC · PLEIN ÉCRAN CAMÉRA'
            : document.elementFromPoint(x, y)?.closest('.hud-carte-zone') ? 'CLIC · CARTE EN GRAND' : null)} />
      )}
      <Overlay />
      {etape === 'bios' && <Demarrage pret={pret} onFini={() => setEtape('logo')} />}
      {etape === 'logo' && <IntroLogo onFini={() => setEtape('pret')} />}
    </div>
  );
}

function Jauge({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="hud-jauge">
      <div className="hud-jauge-barre"><div style={{ height: `${valeur}%` }} /></div>
      <span className="nombre">{libelle}</span>
    </div>
  );
}
