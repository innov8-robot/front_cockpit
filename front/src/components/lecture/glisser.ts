import { useRef, type MouseEvent, type PointerEvent } from 'react';

/** Ce qu'il faut glisser pour dégager la barre (px) : vers la droite, ou vers le haut (un peu moins). */
const SEUIL_DROITE = 110;
const SEUIL_HAUT = 60;
/** Un geste plus court reste un clic. */
const SEUIL_CLIC = 8;
/** La durée de la sortie (ms). */
const SORTIE_MS = 260;

/**
 * Glisser pour dégager, comme une notification de l'iPhone : quand `actif`, la barre suit le doigt vers le haut ou vers
 * la droite (pas ailleurs) ; lâchée au-delà du seuil, elle part et `degager` est appelé, sinon elle revient en place.
 * Un geste court reste un clic ; un glissé n'en déclenche pas. Les boutons gardent leurs appuis.
 */
export function useGlisser(actif: boolean, degager?: () => void) {
  const element = useRef<HTMLDivElement>(null);
  const depart = useRef<{ x: number; y: number; id: number } | null>(null);
  const decalage = useRef({ x: 0, y: 0 });
  const glisse = useRef(false);

  const poser = (x: number, y: number, transition: string) => {
    const e = element.current;
    if (!e) return;
    e.style.transition = transition;
    e.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
    e.style.opacity = String(Math.max(0.15, 1 - Math.max(x / 360, -y / 160)));
  };

  return {
    ref: element,
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      if (!actif || !degager || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      depart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      glisse.current = false;
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      const d = depart.current;
      if (!d || e.pointerId !== d.id) return;
      const x = Math.max(0, e.clientX - d.x);
      const y = Math.min(0, e.clientY - d.y);
      if (!glisse.current && Math.hypot(x, y) < SEUIL_CLIC) return;
      if (!glisse.current) {
        glisse.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      decalage.current = { x, y };
      poser(x, y, 'none');
    },
    onPointerUp(e: PointerEvent<HTMLDivElement>) {
      const d = depart.current;
      depart.current = null;
      if (!d || e.pointerId !== d.id || !glisse.current) return;
      const { x, y } = decalage.current;
      if (x > SEUIL_DROITE || -y > SEUIL_HAUT) {
        const versDroite = x / SEUIL_DROITE > -y / SEUIL_HAUT;
        poser(versDroite ? window.innerWidth : x, versDroite ? y : -window.innerHeight / 3, `transform ${SORTIE_MS}ms ease-in, opacity ${SORTIE_MS}ms`);
        window.setTimeout(() => {
          degager?.();
          poser(0, 0, 'none');
        }, SORTIE_MS);
      } else {
        poser(0, 0, 'transform 0.35s cubic-bezier(0.3, 1.4, 0.5, 1), opacity 0.35s');
      }
      decalage.current = { x: 0, y: 0 };
    },
    onPointerCancel() {
      depart.current = null;
      poser(0, 0, 'transform 0.3s ease-out, opacity 0.3s');
    },
    /** Un glissé n'est pas un clic : on l'avale avant qu'il n'atteigne la barre. */
    onClickCapture(e: MouseEvent<HTMLDivElement>) {
      if (!glisse.current) return;
      glisse.current = false;
      e.stopPropagation();
    },
  };
}
