import type { ReactNode } from 'react';

/** Les icônes du robot, au trait fin du HUD : 24 × 24, la couleur du texte. */
function Trait({ taille = 18, children }: { taille?: number; children: ReactNode }) {
  return (
    <svg className="icone-robot" width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Le corps : la tête et le buste, le haut de la poitrine marqué. */
export function IconeCorps({ taille }: { taille?: number }) {
  return (
    <Trait taille={taille}>
      <rect x="8.5" y="2.5" width="7" height="6" rx="2.2" />
      <path d="M4.5 21v-5.5A4.5 4.5 0 0 1 9 11h6a4.5 4.5 0 0 1 4.5 4.5V21" />
      <path d="M9 15.5h6" />
    </Trait>
  );
}

/** Le bras : le socle, l'épaule, le coude et la pince au bout. */
export function IconeBras({ taille }: { taille?: number }) {
  return (
    <Trait taille={taille}>
      <path d="M3.5 21h9M5.5 21v-2.5h5V21" />
      <circle cx="8" cy="15.5" r="1.8" />
      <circle cx="12" cy="7" r="1.8" />
      <path d="M8.8 13.9l2.4-5.2M13.7 7.8l3.8 2" />
      <path d="M17.5 8.2l2.8-1.4M17.5 11.6l2.8 1.4M17.5 8.2v3.4" />
    </Trait>
  );
}

/** La main : les doigts et le pouce. */
export function IconeMains({ taille }: { taille?: number }) {
  return (
    <Trait taille={taille}>
      <path d="M8 12.5V6.5a1.3 1.3 0 0 1 2.6 0V11" />
      <path d="M10.6 10.5V5a1.3 1.3 0 0 1 2.6 0v5.5" />
      <path d="M13.2 10.5V6a1.3 1.3 0 0 1 2.6 0v8a5.5 5.5 0 0 1-5.5 5.5h-.6a5 5 0 0 1-4.2-2.3L3.9 13.8a1.3 1.3 0 0 1 2.1-1.5L8 14.5" />
    </Trait>
  );
}

/** Une pince à mors parallèles ; `ouverture` de 0 (fermée) à 1 (grande ouverte) écarte ses deux mors. */
export function IconePince({ ouverture, taille }: { ouverture: number; taille?: number }) {
  const ecart = 4.5 * Math.min(1, Math.max(0, ouverture));
  return (
    <Trait taille={taille}>
      <rect x="3.5" y="14" width="17" height="5" rx="1.2" />
      <path d="M12 19v3" />
      <g className="icone-mors" style={{ transform: `translateX(${-ecart}px)` }}><path d="M11 14V4.5h1" /></g>
      <g className="icone-mors" style={{ transform: `translateX(${ecart}px)` }}><path d="M13 14V4.5h-1" /></g>
    </Trait>
  );
}

/** L'atelier : un meuble en fil de fer. */
export function IconeAtelier({ taille }: { taille?: number }) {
  return (
    <Trait taille={taille}>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </Trait>
  );
}

/** La caméra de tête : le boîtier et ses deux objectifs. */
export function IconeCamera({ taille }: { taille?: number }) {
  return (
    <Trait taille={taille}>
      <rect x="3" y="8" width="18" height="9" rx="2.5" />
      <circle cx="8.5" cy="12.5" r="2" />
      <circle cx="15.5" cy="12.5" r="2" />
    </Trait>
  );
}

/** Le lidar : ses ondes autour du capteur. */
export function IconeLidar({ taille }: { taille?: number }) {
  return (
    <Trait taille={taille}>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </Trait>
  );
}

/** Les objets déclarés : un cadre de détection, ses coins marqués. */
export function IconeObjets({ taille }: { taille?: number }) {
  return (
    <Trait taille={taille}>
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
    </Trait>
  );
}

/** La grille du sol. */
export function IconeGrille({ taille }: { taille?: number }) {
  return (
    <Trait taille={taille}>
      <path d="M3 9l9-4 9 4-9 4z" />
      <path d="M3 14l9 4 9-4M7.5 7l9 4M16.5 7l-9 4" />
    </Trait>
  );
}
