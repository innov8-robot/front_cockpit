import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface Point { x: number; y: number }

/** La vitesse de la caméra le long du fil (px/s), et les bornes d'un trajet (ms). */
const VITESSE = 300;
const DUREE_MIN = 700;
const DUREE_MAX = 1800;

const lisse = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const entre = (a: Point, b: Point, u: number): Point => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Pose la caméra : le point `p` du monde va à l'ancre de la vue. */
function placer(vue: HTMLElement, monde: HTMLElement, p: Point, ancre: Point) {
  monde.style.transform = `translate(${Math.round(vue.clientWidth * ancre.x - p.x)}px, ${Math.round(vue.clientHeight * ancre.y - p.y)}px)`;
}

/**
 * Le travelling de la barre de lecture. Quand l'étape change (`cle`), la caméra rejoint le début du fil qui y mène,
 * le suit jusqu'au bout — l'étincelle reste sous la caméra et le fil s'allume derrière elle — puis se pose sur
 * l'étape. Le fil est le chemin SVG marqué `data-lien` ; le tracé qui s'allume, celui marqué `data-trace`.
 * `arrivee` vaut la clé de la dernière étape atteinte : l'étape ne s'ouvre qu'à l'arrivée de l'étincelle.
 */
export function useTravelling(cle: string, cible: Point, lien: string | null, ancre: Point) {
  const vue = useRef<HTMLDivElement>(null);
  const monde = useRef<HTMLDivElement>(null);
  const etincelle = useRef<SVGGElement>(null);
  const camera = useRef<Point | null>(null);
  const enRoute = useRef(false);
  const [arrivee, setArrivee] = useState(cle);

  useLayoutEffect(() => {
    const v = vue.current;
    const m = monde.current;
    if (!v || !m) return;
    if (!camera.current) {
      camera.current = cible;
      placer(v, m, cible, ancre);
      return;
    }
    const chemin = lien ? m.querySelector<SVGPathElement>(`[data-lien="${lien}"]`) : null;
    const trace = m.querySelector<SVGPathElement>('[data-trace]');
    const longueur = chemin?.getTotalLength() ?? 0;
    const depart = camera.current;
    const entree = chemin ? chemin.getPointAtLength(0) : depart;
    const sortie = chemin ? chemin.getPointAtLength(longueur) : depart;
    const a = distance(depart, entree);
    const c = distance(sortie, cible);
    const total = a + longueur + c;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duree = reduit ? 0 : Math.min(DUREE_MAX, Math.max(DUREE_MIN, (total / VITESSE) * 1000));
    let t0 = -1;
    let id = 0;
    enRoute.current = true;
    const image = (maintenant: number) => {
      if (t0 < 0) t0 = maintenant;
      const u = duree ? Math.min(1, (maintenant - t0) / duree) : 1;
      const s = lisse(u) * total;
      const surFil = chemin !== null && s > a && s < a + longueur;
      const p = s <= a ? entre(depart, entree, a ? s / a : 1)
        : s < a + longueur ? chemin!.getPointAtLength(s - a)
        : entre(sortie, cible, c ? (s - a - longueur) / c : 1);
      camera.current = { x: p.x, y: p.y };
      placer(v, m, camera.current, ancre);
      if (trace) trace.style.strokeDashoffset = String(1 - Math.min(1, Math.max(0, (s - a) / (longueur || 1))));
      if (etincelle.current) {
        etincelle.current.style.opacity = surFil ? '1' : '0';
        etincelle.current.setAttribute('transform', `translate(${p.x} ${p.y})`);
      }
      if (u < 1) {
        id = requestAnimationFrame(image);
        return;
      }
      enRoute.current = false;
      setArrivee(cle);
    };
    id = requestAnimationFrame(image);
    return () => {
      cancelAnimationFrame(id);
      enRoute.current = false;
    };
  }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = vue.current;
    if (!v) return;
    const observateur = new ResizeObserver(() => {
      if (!enRoute.current && camera.current && monde.current) placer(v, monde.current, camera.current, ancre);
    });
    observateur.observe(v);
    return () => observateur.disconnect();
  }, [ancre]);

  return { vue, monde, etincelle, arrivee };
}
