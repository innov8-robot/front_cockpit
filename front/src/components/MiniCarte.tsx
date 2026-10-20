import { useEffect, useRef, useState } from 'react';

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
const METRES_PAR_COTE = 2.5;
/** La place du robot dans le carré, en fraction du côté (depuis le coin haut gauche). */
const DECALAGE = { x: 0.42, y: 0.58 };
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
export function MiniCarte({ poste }: { poste: string | null }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [carte, setCarte] = useState<Carte | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    fetch('carte/carte.json').then((r) => r.json()).then(setCarte).catch(() => setErreur(true));
  }, []);

  useEffect(() => {
    const c = toile.current;
    if (!c || !carte) return;
    const grille = rendreGrille(carte);
    const robot = (poste && carte.postes[poste]) || Object.values(carte.postes)[0] || { x: 0, y: 0, yaw: 0 };
    let image = 0;

    const dessiner = (t: number) => {
      const ratio = Math.min(devicePixelRatio, 2);
      const L = c.clientWidth;
      const H = c.clientHeight;
      if (c.width !== L * ratio) { c.width = L * ratio; c.height = H * ratio; }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, L, H);
      // Le fondu mange le haut et la droite : le robot va au centre de ce qui reste visible.
      const cx = L * DECALAGE.x;
      const cy = H * DECALAGE.y;
      const PIXELS_PAR_METRE = L / METRES_PAR_COTE;

      // Repère monde (x, y en mètres, y vers le haut) vers l'écran, cap du robot en haut.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(robot.yaw - Math.PI / 2);
      ctx.scale(PIXELS_PAR_METRE, -PIXELS_PAR_METRE);
      ctx.translate(-robot.x, -robot.y);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(carte.x0, carte.y0 + carte.h * carte.res);
      ctx.scale(carte.res, -carte.res);
      ctx.drawImage(grille.libre, 0, 0);
      ctx.shadowColor = 'rgb(160 190 255 / 0.9)';
      ctx.shadowBlur = 8;
      ctx.drawImage(grille.murs, 0, 0);
      ctx.restore();

      const nommes: Pose[] = [robot];
      for (const [nom, p] of Object.entries(carte.postes)) {
        if (nom === poste) continue;
        const libre = nommes.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > ECART_NOMS_M);
        if (libre) nommes.push(p);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1 / PIXELS_PAR_METRE, -1 / PIXELS_PAR_METRE);
        ctx.rotate(-(robot.yaw - Math.PI / 2));
        ctx.fillStyle = '#8fa0bd';
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (libre) {
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillStyle = 'rgb(170 182 202 / 0.9)';
          ctx.fillText(nom.toUpperCase(), 5, 3);
        }
        ctx.restore();
      }
      ctx.restore();

      // Le robot : un triangle rouge cap en haut, et une onde qui part de lui.
      const onde = (t / 1600) % 1;
      ctx.strokeStyle = `rgb(255 45 58 / ${0.5 * (1 - onde)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + onde * 26, 0, Math.PI * 2);
      ctx.stroke();
      const cone = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
      cone.addColorStop(0, 'rgb(255 45 58 / 0.28)');
      cone.addColorStop(1, 'rgb(255 45 58 / 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 60, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
      ctx.fill();
      ctx.shadowColor = '#ff2d3a';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff2d3a';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 6.5, cy + 7);
      ctx.lineTo(cx, cy + 3.5);
      ctx.lineTo(cx - 6.5, cy + 7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      image = requestAnimationFrame(dessiner);
    };
    image = requestAnimationFrame(dessiner);
    return () => cancelAnimationFrame(image);
  }, [carte, poste]);

  if (erreur) return null;
  return (
    <aside className="hud-carte" aria-label={carte ? `Carte ${carte.nom}` : 'Carte'}>
      <canvas ref={toile} />
      {carte && (
        <div className="hud-carte-legende">
          <span>CARTE · {carte.nom.toUpperCase()}</span>
          <span className="nombre">{poste ? `POSTE ${poste.toUpperCase()}` : ''}</span>
        </div>
      )}
    </aside>
  );
}
