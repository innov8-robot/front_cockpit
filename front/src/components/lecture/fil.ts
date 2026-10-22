/**
 * Le graphe de la mission dessiné dans la barre de lecture : les nœuds aux positions de l'éditeur, réduites, et les
 * fils de l'éditeur (courbes, retours par-dessous). Chaque nœud et chaque fil prend l'état du tour en cours.
 */
import { getBezierPath, Position } from '@xyflow/react';
import { sortiesVisibles, type TypeNoeud } from '../missions/catalogue';
import { SORTIES, type EtatLien, type Sortie, type Ton } from '../missions/charte';
import { cheminRetour, tonDe } from '../missions/liens';
import type { Lecture } from './lecture';
import type { EtapeCamera, Point } from './travelling';

/**
 * L'échelle du canevas de l'éditeur dans la barre. Le haut et le bas sont plus serrés que la largeur : une branche
 * qui monte ou descend reste en partie visible dans une barre basse, et la caméra la suit quand la mission la prend.
 */
const ECHELLE = { x: 0.55, y: 0.22 };
const DEMI_TUILE_EDITEUR = 38;
/** Le retour d'une boucle passe sous les nœuds, à la distance de l'éditeur, réduite. */
const RETOUR = { sous: 96 * ECHELLE.y, ecart: 24 * ECHELLE.x, r: 6 };
export const TUILE = 28;
export const TUILE_OUVERTE = 36;
/** Quand l'étape d'avant est plus haut, la caméra remonte de cette part de l'écart : le fil qui arrive reste visible. */
const CADRAGE_HAUT = 0.3;

export type EtatFil = 'ok' | 'echec' | 'cours' | 'pause' | 'danger' | 'erreur' | 'arrete' | 'approche' | 'prevu' | 'hors';

export interface NoeudFil {
  id: string;
  type: TypeNoeud;
  nom: string;
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
  pointille: boolean;
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

const lienEntre = (l: Lecture, de: string, vers: string, sortie: Sortie) =>
  l.mission.liens.find((x) => x.de === de && x.vers === vers && x.sortie === sortie);

/** Une étape du parcours de la mission : sa clé, son nœud, et le fil qui y mène. */
export interface EtapeParcours { cle: string; noeud: string; lien: string | null }

/**
 * Le parcours de la mission : chaque étape jouée jusqu'à celle en cours (ou la dernière jouée, une fois la mission
 * finie, sous une clé à part), avec le fil qui y mène. C'est ce que la caméra suit, dans la barre comme dans l'éditeur.
 */
export function etapesDe(l: Lecture): EtapeParcours[] {
  const fin = l.courant >= 0 ? l.courant : l.pas.length - 1;
  const etapes = l.pas.slice(0, fin + 1).map((p, i) => ({ cle: p.cle, noeud: p.noeud, lien: lienEntre(l, precedent(l, i), p.noeud, p.par)?.id ?? null }));
  const derniere = etapes.at(-1);
  if (l.courant < 0 && derniere) etapes[etapes.length - 1] = { ...derniere, cle: `fin:${derniere.cle}`, lien: null };
  return etapes;
}

/** Une étape du parcours de la caméra de la barre, avec le nœud qu'elle ouvre. */
export interface EtapeTrajet extends EtapeCamera { noeud: string }

/**
 * Le parcours de la caméra de la barre : les étapes de la mission, chacune avec le point à cadrer. Quand l'étape d'avant
 * est plus haut, la caméra remonte un peu : le fil qui arrive reste visible.
 */
export function trajets(l: Lecture): EtapeTrajet[] {
  return etapesDe(l).map((e, i) => {
    const n = l.mission.noeuds.find((x) => x.id === e.noeud) ?? l.mission.noeuds[0];
    const de = i > 0 && l.pas[i - 1]?.tour === l.pas[i]?.tour ? l.pas[i - 1].noeud : 'depart';
    const ici = centre(n);
    const avant = centre(l.mission.noeuds.find((x) => x.id === de) ?? n);
    return { ...e, cible: { x: ici.x, y: ici.y + Math.min(0, avant.y - ici.y) * CADRAGE_HAUT } };
  });
}

function etatDuPas(l: Lecture, issue: string, arrive: boolean): EtatFil {
  if (issue === 'reussi') return 'ok';
  if (issue === 'echoue') return 'echec';
  if (issue === 'prevu') return 'prevu';
  if (l.etat === 'urgence') return 'danger';
  if (!arrive) return 'approche';
  return l.etat === 'pause' ? 'pause' : 'cours';
}

/**
 * Le tracé d'un fil, de la sortie d'un nœud à l'entrée d'un autre : une courbe, ou un retour par-dessous. Les sorties
 * d'un nœud se répartissent sur son bord droit, dans l'ordre du catalogue, comme dans l'éditeur.
 */
function trace(a: NoeudFil, b: NoeudFil, sortie: Sortie, sorties: Sortie[]) {
  const rang = sorties.indexOf(sortie);
  const sx = a.x + a.taille / 2;
  const sy = rang < 0 ? a.y : a.y - a.taille / 2 + (a.taille * (rang + 1)) / (sorties.length + 1);
  const tx = b.x - b.taille / 2;
  if (tx < sx + 10) return cheminRetour(sx, sy, tx, b.y, RETOUR);
  return { d: getBezierPath({ sourceX: sx, sourceY: sy, sourcePosition: Position.Right, targetX: tx, targetY: b.y, targetPosition: Position.Left })[0], fleche: null };
}

/** Ce qui s'est passé dans le tour, nœud par nœud, avec le fil qui y a mené. */
interface Trace { noeud: string; lien: string | null; etat: EtatFil; prevu: boolean; courant: boolean }

/**
 * Le tour en cours, rejoué dans l'ordre. Repasser par un nœud — une boucle qui reprend — remet à neuf ce qui l'a suivi
 * la fois d'avant : on voit le tour de boucle en cours, pas l'empilement des précédents.
 */
function historique(l: Lecture, arrive: boolean): Trace[] {
  const i = indexCible(l);
  const tour = l.pas[i]?.tour;
  const h: Trace[] = [{ noeud: 'depart', lien: null, etat: 'ok', prevu: false, courant: false }];
  for (const [k, p] of l.pas.entries()) {
    if (p.tour !== tour) continue;
    const lien = lienEntre(l, precedent(l, k), p.noeud, p.par)?.id ?? null;
    const avant = h.findLastIndex((x) => x.noeud === p.noeud);
    if (avant >= 0 && p.issue !== 'prevu') h.splice(avant + 1);
    const derniere = k === l.pas.length - 1;
    const etat = l.etat === 'erreur' && derniere ? 'erreur' : l.etat === 'arretee' && derniere ? 'arrete' : etatDuPas(l, p.issue, arrive);
    h.push({ noeud: p.noeud, lien, etat: p.issue === 'prevu' && avant >= 0 ? h[avant].etat : etat, prevu: p.issue === 'prevu', courant: k === l.courant });
  }
  return h;
}

/** L'état de chaque nœud et de chaque fil pour le tour en cours, et le fil qui mène à l'étape en cours. */
export function etatsDuTour(l: Lecture, arrive: boolean) {
  const h = historique(l, arrive);
  const pris = new Map<string, EtatLien>();
  for (const x of h) if (x.lien) pris.set(x.lien, x.courant ? (arrive ? 'actif' : 'aucun') : x.prevu ? 'aucun' : 'parcouru');
  return { noeuds: new Map(h.map((x) => [x.noeud, x.etat])), liens: pris, lienCourant: h.find((x) => x.courant)?.lien ?? null };
}

/**
 * Les nœuds et les fils de la mission dans l'état du tour en cours. Tant que l'étincelle n'est pas `arrive`e, l'étape
 * en cours est « en approche » et son fil n'a pas encore son onde.
 */
export function construireFil(l: Lecture, arrive: boolean): { noeuds: NoeudFil[]; liens: LienFil[]; lienCourant: LienFil | null } {
  const { noeuds: etats, liens: pris, lienCourant: idCourant } = etatsDuTour(l, arrive);
  const ouvert = l.courant >= 0 && arrive ? l.pas[l.courant].noeud : null;
  const noeuds: NoeudFil[] = l.mission.noeuds.map((n) => ({
    id: n.id, type: n.type, nom: n.nom, ...centre(n), taille: n.id === ouvert ? TUILE_OUVERTE : TUILE, etat: etats.get(n.id) ?? 'hors',
  }));
  const parId = new Map(noeuds.map((n) => [n.id, n]));
  const avecEchec = new Set(l.mission.liens.filter((x) => x.sortie === 'echec').map((x) => x.de));
  const liens = l.mission.liens.flatMap((x): LienFil[] => {
    const a = parId.get(x.de);
    const b = parId.get(x.vers);
    if (!a || !b) return [];
    const { d, fleche } = trace(a, b, x.sortie, sortiesVisibles(a.type, avecEchec.has(a.id)));
    const courant = x.id === idCourant;
    const ton: Ton = courant && l.etat === 'urgence' ? 'danger' : courant && l.etat === 'pause' ? 'neutre' : tonDe(x.sortie);
    return [{ id: x.id, d, fleche, etat: pris.get(x.id) ?? 'aucun', ton, pointille: SORTIES[x.sortie].pointille, hors: !pris.has(x.id) }];
  });
  return { noeuds, liens, lienCourant: liens.find((k) => k.id === idCourant) ?? null };
}
