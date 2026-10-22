import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface Point { x: number; y: number }

/** Une étape du parcours de la caméra : la clé de l'étape, le fil qui y mène, et le point à cadrer en arrivant. */
export interface EtapeCamera { cle: string; lien: string | null; cible: Point }

/** Ce que le parcours fait d'une caméra : la poser sur un point, trouver le tracé d'un fil, et dessiner chaque image. */
export interface Camera {
  placer(p: Point): void;
  chemin(lien: string): SVGPathElement | null;
  /** À chaque image : le point de la caméra, si elle est sur un fil, et la part faite du dernier fil (null avant). */
  image?(p: Point, surFil: boolean, fait: number | null): void;
}

/** La vitesse de la caméra le long du fil (px/s), et les bornes d'un trajet (ms). */
const VITESSE = 300;
const DUREE_MIN = 160;
const DUREE_MAX = 1800;
/** Un trajet tient dans cette part du temps entre deux étapes : la caméra ne prend pas de retard sur la mission. */
const PART_DU_RYTHME = 0.7;

const lisse = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const entre = (a: Point, b: Point, u: number): Point => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Le parcours de la caméra, le même partout où l'on suit une mission — la barre de lecture, le workflow déplié,
 * l'éditeur. `etapes` est le parcours de la mission jusqu'à l'étape en cours, la dernière. Quand elle change, la caméra
 * parcourt dans l'ordre chaque fil emprunté depuis la dernière étape où elle s'est posée (une entrée puis une sortie de
 * boucle rapides, une étape sautée entre deux relectures), et va d'autant plus vite qu'il lui reste de fils et que les
 * étapes s'enchaînent vite. `camera` (stable) dit comment la poser ; sans elle, rien ne bouge. `arrivee` vaut la clé de
 * la dernière étape atteinte.
 */
export function useParcours(etapes: EtapeCamera[], camera: () => Camera | null) {
  const position = useRef<Point | null>(null);
  const file = useRef<EtapeCamera[]>([]);
  const derniere = useRef<string | null>(null);
  const image = useRef(0);
  const rythme = useRef(DUREE_MAX / PART_DU_RYTHME);
  const dernierAjout = useRef(0);
  const cible = etapes.at(-1);
  const [arrivee, setArrivee] = useState(cible?.cle ?? '');

  const parcourir = useCallback(function suivre() {
    const cam = camera();
    const etape = file.current.shift();
    if (!cam || !etape) return;
    const chemin = etape.lien ? cam.chemin(etape.lien) : null;
    const derniereEtape = file.current.length === 0;
    const longueur = chemin?.getTotalLength() ?? 0;
    const depart = position.current ?? etape.cible;
    const entree = chemin ? chemin.getPointAtLength(0) : depart;
    const sortie = chemin ? chemin.getPointAtLength(longueur) : depart;
    const a = distance(depart, entree);
    const c = distance(sortie, etape.cible);
    const total = a + longueur + c;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const voulue = Math.min(DUREE_MAX, (total / VITESSE) * 1000, (rythme.current * PART_DU_RYTHME) / (file.current.length + 1));
    const duree = reduit ? 0 : Math.max(DUREE_MIN, voulue);
    let t0 = -1;
    const pas = (maintenant: number) => {
      if (t0 < 0) t0 = maintenant;
      const u = duree ? Math.min(1, (maintenant - t0) / duree) : 1;
      const s = lisse(u) * total;
      const p = s <= a ? entre(depart, entree, a ? s / a : 1)
        : s < a + longueur ? chemin!.getPointAtLength(s - a)
        : entre(sortie, etape.cible, c ? (s - a - longueur) / c : 1);
      position.current = { x: p.x, y: p.y };
      cam.placer(position.current);
      cam.image?.(position.current, chemin !== null && s > a && s < a + longueur,
        derniereEtape ? Math.min(1, Math.max(0, (s - a) / (longueur || 1))) : null);
      if (u < 1) {
        image.current = requestAnimationFrame(pas);
        return;
      }
      image.current = 0;
      if (file.current.length) suivre();
      else setArrivee(etape.cle);
    };
    image.current = requestAnimationFrame(pas);
  }, [camera]);

  useLayoutEffect(() => {
    const cam = camera();
    if (!cible || !cam) return;
    if (!position.current) {
      position.current = cible.cible;
      derniere.current = cible.cle;
      cam.placer(cible.cible);
      if (arrivee !== cible.cle) image.current = requestAnimationFrame(() => { image.current = 0; setArrivee(cible.cle); });
      return;
    }
    if (derniere.current === cible.cle) return;
    const i = etapes.findIndex((e) => e.cle === derniere.current);
    derniere.current = cible.cle;
    const maintenant = performance.now();
    if (dernierAjout.current) rythme.current = 0.6 * rythme.current + 0.4 * (maintenant - dernierAjout.current);
    dernierAjout.current = maintenant;
    file.current.push(...(i >= 0 ? etapes.slice(i + 1) : [cible]));
    if (!image.current) parcourir();
  }, [cible?.cle, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(image.current), []);

  return { arrivee, position, enRoute: image };
}

/** Pose le dessin de la barre : le point `p` du monde va à l'ancre de la vue. */
function placer(vue: HTMLElement, monde: HTMLElement, p: Point, ancre: Point) {
  monde.style.transform = `translate(${Math.round(vue.clientWidth * ancre.x - p.x)}px, ${Math.round(vue.clientHeight * ancre.y - p.y)}px)`;
}

/**
 * Le travelling de la barre de lecture : le parcours de la caméra (`useParcours`) sur le dessin du fil. L'étincelle
 * reste sous la caméra et le dernier fil s'allume derrière elle (le tracé marqué `data-trace`) ; les fils sont les
 * chemins marqués `data-lien`.
 */
export function useTravelling(etapes: EtapeCamera[], ancre: Point) {
  const vue = useRef<HTMLDivElement>(null);
  const monde = useRef<HTMLDivElement>(null);
  const etincelle = useRef<SVGGElement>(null);
  const camera = useCallback((): Camera | null => {
    const v = vue.current;
    const m = monde.current;
    if (!v || !m) return null;
    return {
      placer: (p) => placer(v, m, p, ancre),
      chemin: (lien) => m.querySelector<SVGPathElement>(`[data-lien="${lien}"]`),
      image: (p, surFil, fait) => {
        const trace = fait === null ? null : m.querySelector<SVGPathElement>('[data-trace]');
        if (trace && fait !== null) trace.style.strokeDashoffset = String(1 - fait);
        if (etincelle.current) {
          etincelle.current.style.opacity = surFil ? '1' : '0';
          etincelle.current.setAttribute('transform', `translate(${p.x} ${p.y})`);
        }
      },
    };
  }, [ancre]);
  const { arrivee, position, enRoute } = useParcours(etapes, camera);

  useEffect(() => {
    const v = vue.current;
    if (!v) return;
    const observateur = new ResizeObserver(() => {
      if (!enRoute.current && position.current) camera()?.placer(position.current);
    });
    observateur.observe(v);
    return () => observateur.disconnect();
  }, [camera, enRoute, position]);

  return { vue, monde, etincelle, arrivee };
}
