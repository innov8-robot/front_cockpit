import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, enSimulation, robotUnique } from '../api/client';
import type { EtatCapteurs, EtatCorps, Robot, Verdict } from '../api/types';
import { ETATS_ROBOT } from '../api/libelles';
import { reinitialiserSimulation } from '../api/mock';
import { Demarrage } from '../components/Demarrage';
import { IntroLogo } from '../components/IntroLogo';
import { MiniCarte } from '../components/MiniCarte';
import { Reticule } from '../components/Reticule';
import { Overlay } from '../components/Overlay';
import { useCharge } from '../components/useCharge';
import { monterScene, type Calque, type Scene3D } from '../vue3d/scene';

/** Les pastilles du HUD : chacune dit si son élément va bien ; celles qu'on peut masquer basculent au clic. */
type Pastille = 'robot' | 'atelier' | 'camera' | 'lidar' | 'objets';
const PASTILLES: { cle: Pastille; libelle: string; detail: string; masquable: boolean }[] = [
  { cle: 'robot', libelle: 'Robot', detail: 'G1-D', masquable: false },
  { cle: 'atelier', libelle: 'Atelier', detail: 'simulé', masquable: true },
  { cle: 'camera', libelle: 'Caméra', detail: 'RGBD · 30 i/s', masquable: true },
  { cle: 'lidar', libelle: 'Lidar', detail: '360° · 200 k pts/s', masquable: true },
  { cle: 'objets', libelle: 'Objets', detail: 'déclarés', masquable: true },
];
const SANTE_MS = 2000;
const TITRES_VERDICT: Record<Verdict, string> = { ok: 'tout va bien', pb: 'problème', inconnu: 'pas de nouvelles' };

/** Le verdict du robot : arrêt d'urgence ou moteur trop chaud / en défaut = problème ; hors ligne = inconnu. */
function verdictRobot(r: Robot | undefined, corps: EtatCorps | null): { verdict: Verdict; raison: string } {
  if (!r || r.etat === 'hors_ligne') return { verdict: 'inconnu', raison: 'robot hors ligne' };
  if (r.etat === 'arret_urgence') return { verdict: 'pb', raison: 'arrêt d’urgence' };
  const malades = corps?.moteurs.filter((m) => m.etat === 'trop_chaud' || m.etat === 'defaut') ?? [];
  if (malades.length) return { verdict: 'pb', raison: malades.map((m) => `${m.nom} ${m.etat === 'defaut' ? 'en défaut' : `${m.temperature}°`}`).join(' · ') };
  return { verdict: corps ? 'ok' : 'inconnu', raison: corps ? 'moteurs dans leurs seuils' : 'en attente de l’état des moteurs' };
}

function heure(): string {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function Accueil() {
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
  const [calques, setCalques] = useState<Record<Calque, boolean>>({ robot: true, atelier: true, camera: true, lidar: true, objets: true, sol: true });
  const [maintenant, setMaintenant] = useState(heure);
  const robot = useCharge(robotUnique).donnee;
  const [sante, setSante] = useState<{ robot?: Robot; corps: EtatCorps | null; capteurs: EtatCapteurs | null }>({ corps: null, capteurs: null });
  useEffect(() => {
    let vivant = true;
    const lire = async () => {
      const r = await robotUnique().catch(() => undefined);
      const [corps, capteurs] = r
        ? await Promise.all([api.etatCorps(r.id).catch(() => null), api.etatCapteurs(r.id).catch(() => null)])
        : [null, null];
      if (vivant) setSante({ robot: r, corps, capteurs });
    };
    lire();
    const t = setInterval(lire, SANTE_MS);
    return () => { vivant = false; clearInterval(t); };
  }, []);

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
          <NavLink to="/" end>Vue</NavLink>
          <NavLink to="/robot">Robot</NavLink>
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
        <NavLink to="/robot/corps" className="hud-jauges" aria-label="État du corps">
          <Jauge libelle="BAT" valeur={robot.batterie} />
          <Jauge libelle="SIG" valeur={robot.etat === 'hors_ligne' ? 0 : 86} />
          <div className="hud-console nombre">
            <span>[LIDAR....]</span>
            <span className="hud-vert">[......OK]</span>
            <span>[RGBD.....]</span>
            <span className="hud-vert">[......OK]</span>
            <span className="hud-corps">[CORPS....]</span>
            <span className="hud-corps">[.......▸]</span>
          </div>
        </NavLink>
      )}


      <MiniCarte poste={robot?.posteCourant ?? null} plein={plein === 'carte'}
        basculer={(p) => setPlein(p ? 'carte' : null)} />

      {(plein === 'camera') && (
        <div className="vue-camera" aria-label="Vue de la caméra de tête">
          <ApercuCamera />
          <div className="vue-camera-coins" aria-hidden="true" />
          <p className="vue-camera-titre">CAMÉRA TÊTE · REALSENSE D435i · 87° × 58° · 30 i/s</p>
          <p className="vue-camera-rec"><span /> EN DIRECT</p>
          <button className="hud-plein-fermer" onClick={sortirCamera}>QUITTER LA CAMÉRA <span aria-hidden="true">⤡</span></button>
        </div>
      )}

      <footer className="hud-bas">
        {PASTILLES.map((c) => {
          const { verdict, raison } = c.cle === 'robot' ? verdictRobot(sante.robot, sante.corps)
            : c.cle === 'camera' || c.cle === 'lidar' ? { verdict: sante.capteurs?.[c.cle] ?? 'inconnu', raison: '' }
            : c.cle === 'objets' ? { verdict: nbObjets ? 'ok' as const : 'inconnu' as const, raison: nbObjets ? '' : 'aucun objet déclaré' }
            : { verdict: pret ? 'ok' as const : 'inconnu' as const, raison: '' };
          const visible = !c.masquable || calques[c.cle];
          const titre = `${c.libelle} : ${TITRES_VERDICT[verdict]}${raison ? ` (${raison})` : ''}${c.masquable ? ` · clic pour ${visible ? 'masquer' : 'afficher'}` : ''}`;
          const contenu = (
            <>
              <span className="hud-calque-nom"><span className={`hud-verdict verdict-${verdict}`} />{c.libelle}</span>
              <span className="hud-calque-detail">{c.cle === 'objets' && nbObjets ? `${nbObjets} ${c.detail}` : c.detail}</span>
            </>
          );
          return c.masquable ? (
            <button key={c.cle} className={`hud-calque ${visible ? 'actif' : 'masque'}`} aria-pressed={visible} title={titre}
              onClick={() => basculer(c.cle as Calque)}>{contenu}</button>
          ) : (
            <NavLink key={c.cle} to="/robot/corps" className="hud-calque actif fixe" title={titre}>{contenu}</NavLink>
          );
        })}
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

/** La dernière image réelle de la caméra de tête (scripts/copier-camera.mjs), tant que le back ne sert pas le flux. */
type ModeCamera = 'image' | 'fpv';

/**
 * La dernière image réelle de la caméra de tête (scripts/copier-camera.mjs), tant que le back ne sert pas le
 * flux ; un sélecteur bascule vers la vue 3D vue de l'œil du robot (la scène, déjà rendue derrière l'image).
 */
function ApercuCamera() {
  const [run, setRun] = useState<string | null>(null);
  const [vue, setVue] = useState(true);
  const [mode, setMode] = useState<ModeCamera>('image');
  useEffect(() => {
    fetch('camera/apercu.json').then((r) => r.json()).then((m: { run: string }) => setRun(m.run)).catch(() => setVue(false));
  }, []);
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v' && !(e.target as HTMLElement).closest('input, textarea, select')) {
        setMode((m) => (m === 'image' ? 'fpv' : 'image'));
      }
    };
    addEventListener('keydown', touche);
    return () => removeEventListener('keydown', touche);
  }, []);
  if (!vue || !run) return null;
  return (
    <>
      <img className={`vue-camera-image ${mode === 'fpv' ? 'cachee' : ''}`} src="camera/apercu.jpg"
        alt="Dernière image de la caméra de tête" onError={() => setVue(false)} />
      <div className="vue-camera-modes" role="group" aria-label="Ce que montre la caméra">
        {([['image', 'IMAGE'], ['fpv', 'VUE 3D']] as [ModeCamera, string][]).map(([m, l]) => (
          <button key={m} className={mode === m ? 'actif' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>{l}</button>
        ))}
        <span className="vue-camera-touche" aria-hidden="true">V</span>
      </div>
      <p className="vue-camera-source">{mode === 'image' ? `IMAGE D'ARCHIVE · ${run}` : 'VUE 3D · ŒIL DU ROBOT · NUAGES SIMULÉS'}</p>
    </>
  );
}
