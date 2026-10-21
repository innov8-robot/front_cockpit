/**
 * La logique d'une mission, écrite une fois et dessinée de trois façons (page #/essai/logique). Trois règles la
 * rendent lisible : réessayer est un réglage du geste ; une branche finit par ce qu'on fait ensuite, jamais par un fil
 * qui remonte ; une boucle porte elle-même son retour.
 */
import type { EtatLien, EtatNoeud, Ton } from './charte';

export type Valeurs = Record<string, string | number>;

/** Ce que fait la mission au bout d'une branche. */
export type Puis = 'suivant' | 'reessayer' | 'arreter' | 'continuer';

export const PUIS: Record<Puis, { icone: string; texte: string }> = {
  suivant: { icone: '↩', texte: 'au suivant' },
  reessayer: { icone: '↺', texte: 'réessayer' },
  arreter: { icone: '■', texte: 'arrêter' },
  continuer: { icone: '→', texte: 'continuer' },
};

export interface Branche { etapes: Etape[]; puis: Puis; texte?: string }
export interface Geste { genre: 'geste'; id: string; cle: string; valeurs?: Valeurs; essais?: number; siEchec?: Branche }
export interface Boucle { genre: 'boucle'; id: string; cle: string; valeurs?: Valeurs; corps: Etape[] }
export interface Si { genre: 'si'; id: string; valeurs?: Valeurs; alors: Branche }
export type Etape = Geste | Boucle | Si;

export const DEPART = 'depart';
export const FIN = 'fin';

/** « Vider la table dans le bac », la mission des trois dessins. */
export const MISSION: Etape[] = [
  { genre: 'geste', id: 'aller', cle: 'deplacer', valeurs: { poste: 'table' } },
  {
    genre: 'boucle', id: 'boucle', cle: 'pour_chaque', valeurs: { objet: 'pièce' }, corps: [
      {
        genre: 'geste', id: 'prendre', cle: 'prise_objet', valeurs: { primitive: 'pièce' }, essais: 2,
        siEchec: { etapes: [{ genre: 'geste', id: 'appel_prise', cle: 'demander' }], puis: 'suivant', texte: 'pièce suivante' },
      },
      { genre: 'geste', id: 'poser', cle: 'depose_objet', valeurs: { primitive: 'bac B' } },
      { genre: 'geste', id: 'compter', cle: 'compteur', valeurs: { variable: 'déposées' } },
      {
        genre: 'si', id: 'plein', valeurs: { condition: 'bac plein' },
        alors: { etapes: [{ genre: 'geste', id: 'appel_bac', cle: 'demander' }], puis: 'continuer' },
      },
    ],
  },
  { genre: 'geste', id: 'rentrer', cle: 'rentrer' },
  { genre: 'geste', id: 'base', cle: 'deplacer', valeurs: { poste: 'base' } },
];

/** Les étapes contenues dans une étape : le corps d'une boucle, ou sa branche. */
export function enfants(e: Etape): Etape[] {
  if (e.genre === 'boucle') return e.corps;
  if (e.genre === 'si') return e.alors.etapes;
  return e.siEchec?.etapes ?? [];
}

function descendants(etapes: Etape[]): string[] {
  return etapes.flatMap((e) => [e.id, ...descendants(enfants(e))]);
}

/** L'étape d'un identifiant, où qu'elle soit dans la mission. */
export function trouver(id: string, etapes: Etape[] = MISSION): Etape | undefined {
  for (const e of etapes) {
    if (e.id === id) return e;
    const r = trouver(id, enfants(e));
    if (r) return r;
  }
  return undefined;
}

/** Un pas de l'exécution simulée ; un tour de boucle au-delà du premier efface l'état de son corps. */
export interface Pas { id: string; etat: EtatNoeud; tour?: number; essai?: number; reponse?: 'oui' | 'non' }

/** Deux pièces : la première passe ; la seconde rate ses deux essais, l'opérateur est appelé, la boucle finit. */
export const DEROULE: Pas[] = [
  { id: DEPART, etat: 'ok' },
  { id: 'aller', etat: 'cours' }, { id: 'aller', etat: 'ok' },
  { id: 'boucle', etat: 'cours', tour: 1 },
  { id: 'prendre', etat: 'cours', essai: 1 }, { id: 'prendre', etat: 'ok' },
  { id: 'poser', etat: 'cours' }, { id: 'poser', etat: 'ok' },
  { id: 'compter', etat: 'cours' }, { id: 'compter', etat: 'ok' },
  { id: 'plein', etat: 'cours' }, { id: 'plein', etat: 'ok', reponse: 'non' },
  { id: 'boucle', etat: 'cours', tour: 2 },
  { id: 'prendre', etat: 'cours', essai: 1 }, { id: 'prendre', etat: 'echec' },
  { id: 'prendre', etat: 'cours', essai: 2 }, { id: 'prendre', etat: 'echec' },
  { id: 'appel_prise', etat: 'cours' }, { id: 'appel_prise', etat: 'ok' },
  { id: 'boucle', etat: 'ok' },
  { id: 'rentrer', etat: 'cours' }, { id: 'rentrer', etat: 'ok' },
  { id: 'base', etat: 'cours' }, { id: 'base', etat: 'ok' },
  { id: FIN, etat: 'cours' }, { id: FIN, etat: 'ok' },
];

/** La mission à un instant de l'exécution. */
export interface Instant {
  etats: Map<string, EtatNoeud>;
  tours: Map<string, number>;
  essais: Map<string, number>;
  reponses: Map<string, 'oui' | 'non'>;
  /** L'étape en cours, s'il y en a une. */
  actif?: string;
  /** La couleur de l'onde qui mène à l'étape en cours : celle de l'issue de l'étape d'avant. */
  ton: Ton;
  fini: boolean;
}

/** L'état de la mission après `k` pas du déroulé (−1 : rien n'a commencé). */
export function instant(k: number): Instant {
  const i: Instant = { etats: new Map(), tours: new Map(), essais: new Map(), reponses: new Map(), ton: 'ok', fini: k >= DEROULE.length - 1 };
  for (const p of DEROULE.slice(0, k + 1)) {
    if (p.tour && p.tour > 1) {
      for (const id of descendants(enfants(trouver(p.id)!))) {
        i.etats.delete(id);
        i.essais.delete(id);
        i.reponses.delete(id);
      }
    }
    i.etats.set(p.id, p.etat);
    if (p.tour) i.tours.set(p.id, p.tour);
    if (p.essai) i.essais.set(p.id, p.essai);
    if (p.reponse) i.reponses.set(p.id, p.reponse);
  }
  const dernier = DEROULE[k];
  if (dernier?.etat === 'cours') i.actif = dernier.id;
  const avant = DEROULE.slice(0, k).reverse().find((p) => p.id !== dernier?.id);
  if (avant?.etat === 'echec') i.ton = 'echec';
  return i;
}

/** L'état d'une étape ; à la fin, ce qui n'a pas été joué est « non joué ». */
export function etatDe(i: Instant, id: string): EtatNoeud | undefined {
  return i.etats.get(id) ?? (i.fini ? 'saute' : undefined);
}

/** L'état d'un trait de `de` vers `a` : actif s'il mène à l'étape en cours, parcouru si ses bouts ont joué. */
export function etatTrait(i: Instant, de: string, a: string): EtatLien {
  if (a && i.actif === a) return 'actif';
  return i.etats.has(de) && (!a || i.etats.has(a)) ? 'parcouru' : 'aucun';
}
