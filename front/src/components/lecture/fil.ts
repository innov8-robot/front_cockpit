/**
 * Le graphe de la mission dessiné dans la barre de lecture : les nœuds aux positions de l'éditeur, réduites, et les
 * fils de l'éditeur (courbes, retours par-dessous). Chaque nœud et chaque fil prend l'état du tour en cours.
 */
import { getBezierPath, Position } from '@xyflow/react';
import type { Primitive } from '../../api/types';
import type { EtatLien, Ton } from '../missions/charte';
import { cheminRetour } from '../missions/liens';
import type { Lecture } from './lecture';
import type { Point } from './travelling';

/**
 * L'échelle du canevas de l'éditeur dans la barre. Le haut et le bas sont plus serrés que la largeur : une branche
 * qui monte ou descend reste en partie visible dans une barre basse, et la caméra la suit quand la mission la prend.
 */
const ECHELLE = { x: 0.55, y: 0.22 };
const DEMI_TUILE_EDITEUR = 38;
export const TUILE = 28;
export const TUILE_OUVERTE = 36;
/** Quand l'étape d'avant est plus haut, la caméra remonte de cette part de l'écart : le fil qui arrive reste visible. */
const CADRAGE_HAUT = 0.3;

export type EtatFil = 'ok' | 'echec' | 'cours' | 'pause' | 'danger' | 'approche' | 'prevu' | 'hors';

export interface NoeudFil {
  id: string;
  primitive: Primitive | undefined;
  depart: boolean;
  x: number;
  y: number;
  taille: number;
  etat: EtatFil;
}

export interface LienFil {
  id: string;
  d: string;
  fleche: string | null;
  etat: EtatLien;
  ton: Ton;
  echec: boolean;
  /** Hors du chemin de ce tour : ni joué, ni en cours, ni prévu. */
  hors: boolean;
}

const indexCible = (l: Lecture) => (l.courant >= 0 ? l.courant : l.pas.length - 1);
const centre = (n: { x: number; y: number }): Point => ({ x: ECHELLE.x * (n.x + DEMI_TUILE_EDITEUR), y: ECHELLE.y * (n.y + DEMI_TUILE_EDITEUR) });

/** Le nœud d'avant dans le même tour, ou le départ. */
function precedent(l: Lecture, i: number): string {
  const p = l.pas[i - 1];
  return p && p.tour === l.pas[i].tour ? p.noeud : 'depart';
}

const lienEntre = (l: Lecture, de: string, vers: string, sortie: string) =>
  l.mission.liens.find((x) => x.de === de && x.vers === vers && x.sortie === sortie);

/** Où va la caméra : l'étape en cours (ou la dernière jouée), et le fil qui y mène. */
export function trajet(l: Lecture): { cle: string; noeud: string | null; cible: Point; lien: string | null } {
  const i = indexCible(l);
  const p = l.pas[i];
  const n = l.mission.noeuds.find((x) => x.id === (p?.noeud ?? 'depart')) ?? l.mission.noeuds[0];
  if (!p || l.courant < 0) return { cle: `fin:${p?.cle ?? ''}`, noeud: p?.noeud ?? null, cible: centre(n), lien: null };
  const de = precedent(l, i);
  const ici = centre(n);
  const avant = centre(l.mission.noeuds.find((x) => x.id === de) ?? n);
  const cible = { x: ici.x, y: ici.y + Math.min(0, avant.y - ici.y) * CADRAGE_HAUT };
  return { cle: p.cle, noeud: p.noeud, cible, lien: lienEntre(l, de, p.noeud, p.par)?.id ?? null };
}

function etatDuPas(l: Lecture, issue: string, arrive: boolean): EtatFil {
  if (issue === 'reussi') return 'ok';
  if (issue === 'echoue') return 'echec';
  if (issue === 'prevu') return 'prevu';
  if (l.etat === 'urgence') return 'danger';
  if (!arrive) return 'approche';
  return l.etat === 'pause' ? 'pause' : 'cours';
}

/** Le tracé d'un fil, de la sortie d'un nœud à l'entrée d'un autre : une courbe, ou un retour par-dessous. */
function trace(a: NoeudFil, b: NoeudFil, sortie: string, deuxSorties: boolean) {
  const sx = a.x + a.taille / 2;
  const sy = a.y + (deuxSorties ? ((sortie === 'echec' ? 1 : -1) * a.taille) / 6 : 0);
  const tx = b.x - b.taille / 2;
  if (tx < sx + 10) return cheminRetour(sx, sy, tx, b.y, { sous: 26, ecart: 12, r: 8 });
  return { d: getBezierPath({ sourceX: sx, sourceY: sy, sourcePosition: Position.Right, targetX: tx, targetY: b.y, targetPosition: Position.Left })[0], fleche: null };
}

/**
 * Les nœuds et les fils de la mission dans l'état du tour en cours. Tant que l'étincelle n'est pas `arrive`e, l'étape
 * en cours est « en approche » et son fil n'a pas encore son onde.
 */
export function construireFil(l: Lecture, arrive: boolean): { noeuds: NoeudFil[]; liens: LienFil[]; lienCourant: LienFil | null } {
  const i = indexCible(l);
  const tour = l.pas[i]?.tour;
  const etats = new Map<string, EtatFil>([['depart', 'ok']]);
  const pris = new Map<string, EtatLien>();
  let idCourant: string | null = null;
  for (const [k, p] of l.pas.entries()) {
    if (p.tour !== tour) continue;
    etats.set(p.noeud, etatDuPas(l, p.issue, arrive));
    const lien = lienEntre(l, precedent(l, k), p.noeud, p.par);
    if (!lien) continue;
    if (k === l.courant) idCourant = lien.id;
    pris.set(lien.id, k === l.courant ? (arrive ? 'actif' : 'aucun') : p.issue === 'prevu' ? 'aucun' : 'parcouru');
  }
  const ouvert = l.courant >= 0 && arrive ? l.pas[i].noeud : null;
  const noeuds: NoeudFil[] = l.mission.noeuds.map((n) => ({
    id: n.id, primitive: l.primitives.find((p) => p.id === n.primitiveId), depart: n.primitiveId === null, ...centre(n),
    taille: n.id === ouvert ? TUILE_OUVERTE : TUILE, etat: etats.get(n.id) ?? 'hors',
  }));
  const parId = new Map(noeuds.map((n) => [n.id, n]));
  const avecEchec = new Set(l.mission.liens.filter((x) => x.sortie === 'echec').map((x) => x.de));
  const liens = l.mission.liens.flatMap((x): LienFil[] => {
    const a = parId.get(x.de);
    const b = parId.get(x.vers);
    if (!a || !b) return [];
    const { d, fleche } = trace(a, b, x.sortie, avecEchec.has(x.de) && !a.depart);
    const courant = x.id === idCourant;
    const ton: Ton = courant && l.etat === 'urgence' ? 'danger' : courant && l.etat === 'pause' ? 'neutre' : x.sortie === 'echec' ? 'echec' : 'ok';
    return [{ id: x.id, d, fleche, etat: pris.get(x.id) ?? 'aucun', ton, echec: x.sortie === 'echec', hors: !pris.has(x.id) }];
  });
  return { noeuds, liens, lienCourant: liens.find((k) => k.id === idCourant) ?? null };
}
