import { useEffect, useRef, useState } from 'react';
import { enSimulation } from '../api/client';
import { urlServeur } from '../api/mode';

interface Pose { x: number; y: number; yaw: number }

interface Carte {
  nom: string;
  x0: number;
  y0: number;
  res: number;
  w: number;
  h: number;
  cellules: string;
  postes: Record<string, Pose>;
}

/** Les octets de la grille du châssis (docs/NAVIGATION.md §9) : 0 jamais vu, 1-127 libre, au-delà occupé. */
const SEUIL_OCCUPE = 127;
/** Le carré montre 2,5 m de côté, quelle que soit sa taille : le zoom est serré sur le robot. */
/** Au réel, la carte du châssis et sa pose sont relues à ces périodes (ms). */
const CARTE_MS = 10_000;
const POSE_MS = 500;

const METRES_PAR_COTE = 2.5;
/** La place du robot dans le carré, en fraction du côté (depuis le coin haut gauche) : le centre de la partie
 * nette de la carte, un quart de disque de rayon ~0,85 côté pris dans le coin haut droit (4r/3π ≈ 0,36 côté). */
const DECALAGE = { x: 0.64, y: 0.36 };
/** Sous cette distance (m) d'un nom déjà écrit, un poste n'a que son point. */
const ECART_NOMS_M = 0.9;

/** Pré-rend la grille une fois, en deux calques : les murs (qui portent le halo) et le sol libre. */
function rendreGrille(c: Carte): { murs: HTMLCanvasElement; libre: HTMLCanvasElement } {
  const octets = Uint8Array.from(atob(c.cellules), (ch) => ch.charCodeAt(0));
  const calque = (garder: (v: number) => boolean, rgba: number[]) => {
    const toile = document.createElement('canvas');
    toile.width = c.w;
    toile.height = c.h;
    const ctx = toile.getContext('2d')!;
    const image = ctx.createImageData(c.w, c.h);
    for (let j = 0; j < c.h; j++) {
      for (let i = 0; i < c.w; i++) {
        // La rangée 0 est le bas du monde : on la dessine en bas de l'image.
        if (garder(octets[j * c.w + i])) image.data.set(rgba, ((c.h - 1 - j) * c.w + i) * 4);
      }
    }
    ctx.putImageData(image, 0, 0);
    return toile;
  };
  return {
    murs: calque((v) => v > SEUIL_OCCUPE, [226, 234, 248, 255]),
    libre: calque((v) => v > 0 && v <= SEUIL_OCCUPE, [70, 92, 130, 60]),
  };
}

/** La carte 2D du châssis en bas à gauche du HUD, cap en haut, centrée sur le robot. */
export function MiniCarte({ poste, plein, basculer }: { poste: string | null; plein: boolean; basculer(plein: boolean): void }) {
  const pleinRef = useRef(plein);
  pleinRef.current = plein;
  const toile = useRef<HTMLCanvasElement>(null);
  const [carte, setCarte] = useState<Carte | null>(null);
  const [erreur, setErreur] = useState(false);

  // La pose mesurée du châssis, au réel ; la boucle de dessin la relit à chaque image, sans refaire la grille.
  const poseMesuree = useRef<Pose | null>(null);

  useEffect(() => {
    if (enSimulation) {
      fetch('carte/carte.json').then((r) => r.json()).then(setCarte).catch(() => setErreur(true));
      return;
    }
    // Au réel, la carte que tient le châssis et sa pose, relues par le serveur du robot.
    const url = urlServeur();
    let vivant = true;
    const lireCarte = () => fetch(`${url}/api/carte`).then((r) => (r.ok ? r.json() : null))
      .then((c) => vivant && c && setCarte({ nom: 'châssis', postes: {}, ...c })).catch(() => undefined);
    const lirePose = () => fetch(`${url}/api/chassis`).then((r) => (r.ok ? r.json() : null))
      .then((c) => { if (vivant && c) poseMesuree.current = c.pose; }).catch(() => undefined);
    lireCarte();
    lirePose();
    const tCarte = setInterval(lireCarte, CARTE_MS);
    const tPose = setInterval(lirePose, POSE_MS);
    return () => { vivant = false; clearInterval(tCarte); clearInterval(tPose); };
  }, []);

  useEffect(() => {
    const c = toile.current;
    if (!c || !carte) return;
    const grille = rendreGrille(carte);
    const auPoste = (poste && carte.postes[poste]) || Object.values(carte.postes)[0] || { x: 0, y: 0, yaw: 0 };
    let image = 0;
    let k = pleinRef.current ? 1 : 0;

    const dessiner = (t: number) => {
      const robot = poseMesuree.current ?? auPoste;
      const ratio = Math.min(devicePixelRatio, 2);
      const L = c.clientWidth;
      const H = c.clientHeight;
      if (c.width !== L * ratio) { c.width = L * ratio; c.height = H * ratio; }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, L, H);
      // k va de 0 (coin, cap en haut, centrée sur le robot) à 1 (plein écran, nord en haut, carte entière).
      k += ((pleinRef.current ? 1 : 0) - k) * 0.12;
      const lerp = (a: number, b: number) => a + (b - a) * k;
      const centreCarte = { x: carte.x0 + (carte.w * carte.res) / 2, y: carte.y0 + (carte.h * carte.res) / 2 };
      const ajuste = Math.min(L / (carte.w * carte.res), H / (carte.h * carte.res)) * 0.88;
      const echelle = lerp(Math.min(L, H) / METRES_PAR_COTE, ajuste);
      let cap = robot.yaw - Math.PI / 2;
      cap -= Math.round(cap / (2 * Math.PI)) * 2 * Math.PI;
      const rotation = lerp(cap, 0);
      const ancre = { x: lerp(L * DECALAGE.x, L / 2), y: lerp(H * DECALAGE.y, H / 2) };
      const vise = { x: lerp(robot.x, centreCarte.x), y: lerp(robot.y, centreCarte.y) };

      // Repère monde (x, y en mètres, y vers le haut) vers l'écran.
      ctx.save();
      ctx.translate(ancre.x, ancre.y);
      ctx.rotate(rotation);
      ctx.scale(echelle, -echelle);
      ctx.translate(-vise.x, -vise.y);
      // Du monde vers les pixels CSS de la toile (le ratio d'écran retiré après coup).
      const versEcran = new DOMMatrix().scale(1 / ratio, 1 / ratio).multiply(ctx.getTransform());
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(carte.x0, carte.y0 + carte.h * carte.res);
      ctx.scale(carte.res, -carte.res);
      ctx.drawImage(grille.libre, 0, 0);
      ctx.shadowColor = 'rgb(160 190 255 / 0.9)';
      ctx.shadowBlur = 8;
      ctx.drawImage(grille.murs, 0, 0);
      ctx.restore();
      ctx.restore();

      // Les postes, en pixels d'écran : un point, et un nom s'il ne touche pas un autre (plus serrés en grand).
      const ecran = (x: number, y: number) => versEcran.transformPoint(new DOMPoint(x, y));
      const ecart = lerp(ECART_NOMS_M, 0.3);
      const nommes: Pose[] = [robot];
      ctx.font = `${Math.round(lerp(9, 12))}px ui-monospace, monospace`;
      for (const [nom, p] of Object.entries(carte.postes)) {
        if (nom === poste) continue;
        const libre = nommes.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > ecart);
        if (libre) nommes.push(p);
        const e = ecran(p.x, p.y);
        ctx.fillStyle = '#8fa0bd';
        ctx.beginPath();
        ctx.arc(e.x, e.y, lerp(2.2, 3.2), 0, Math.PI * 2);
        ctx.fill();
        if (libre) {
          ctx.fillStyle = 'rgb(170 182 202 / 0.9)';
          ctx.fillText(nom.toUpperCase(), e.x + 6, e.y + 3);
        }
      }

      // Le robot : un triangle rouge dans son cap, et une onde qui part de lui.
      const r0 = ecran(robot.x, robot.y);
      const r1 = ecran(robot.x + Math.cos(robot.yaw), robot.y + Math.sin(robot.yaw));
      const angle = Math.atan2(r1.y - r0.y, r1.x - r0.x) + Math.PI / 2;
      const cx = r0.x;
      const cy = r0.y;
      const onde = (t / 1600) % 1;
      ctx.strokeStyle = `rgb(255 45 58 / ${0.5 * (1 - onde)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + onde * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const cone = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
      cone.addColorStop(0, 'rgb(255 45 58 / 0.28)');
      cone.addColorStop(1, 'rgb(255 45 58 / 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 60, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
      ctx.fill();
      ctx.shadowColor = '#ff2d3a';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff2d3a';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6.5, 7);
      ctx.lineTo(0, 3.5);
      ctx.lineTo(-6.5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      image = requestAnimationFrame(dessiner);
    };
    image = requestAnimationFrame(dessiner);
    return () => cancelAnimationFrame(image);
  }, [carte, poste]);

  useEffect(() => {
    if (!plein) return;
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && basculer(false);
    addEventListener('keydown', touche);
    return () => removeEventListener('keydown', touche);
  }, [plein, basculer]);

  if (erreur) return null;
  return (
    <aside className={`hud-carte ${plein ? 'plein' : ''}`} aria-label={carte ? `Carte ${carte.nom}` : 'Carte'}>
      <canvas ref={toile} />
      <button className="hud-carte-zone" aria-label="Agrandir la carte" onClick={() => basculer(true)} />
      {carte && (
        <div className="hud-carte-legende">
          <span>CARTE · {carte.nom.toUpperCase()}</span>
          <span className="nombre">{poste ? `POSTE ${poste.toUpperCase()}` : ''}</span>
          {!plein && <span className="hud-carte-indice">⤢ AGRANDIR</span>}
        </div>
      )}
      {plein && (
        <button className="hud-plein-fermer" onClick={(e) => { e.stopPropagation(); basculer(false); }}>
          RÉDUIRE <span aria-hidden="true">⤡</span>
        </button>
      )}
    </aside>
  );
}
