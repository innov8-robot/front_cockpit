/**
 * La géométrie d'une structure de logique sur le canevas : une tête (« POUR CHAQUE pièce SUR la table »), un rail à
 * gauche, ses sections séparées par leurs barres (« SINON »), une ligne de fin (« FIN POUR »). Le nœud la dessine, le
 * prototype y range les étapes : les deux lisent les mêmes cotes.
 */
import type { Section, TypeNoeud } from './catalogue';

export const TETE = 44;
export const BARRE = 30;
export const PIED = 30;
export const RAIL = 14;
const SECTION = 56;

/** Une section placée : sa barre (si elle a un titre), son haut, sa hauteur, et la hauteur de son départ ▸. */
export interface SectionPlacee extends Section { barre?: number; haut: number; h: number; depart: number }

/** Les sections d'une structure de haut en bas, la ligne de fin et la hauteur totale. */
export function placerSections(type: TypeNoeud, hauteurs: number[] = []) {
  let y = TETE;
  const sections: SectionPlacee[] = (type.structure?.sections ?? []).map((s, i) => {
    const barre = s.titre ? y : undefined;
    if (s.titre) y += BARRE;
    const h = hauteurs[i] ?? SECTION;
    const placee = { ...s, barre, haut: y, h, depart: y + Math.min(42, h / 2) };
    y += h;
    return placee;
  });
  return { sections, pied: y, hauteur: y + PIED };
}
