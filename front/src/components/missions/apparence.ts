/**
 * L'apparence de l'éditeur, à comparer sur la page d'essai : les icônes en points (la matrice du logo de démarrage) ou
 * au trait, et les couleurs du thème Spectre de l'appli ou une couleur par famille.
 */
import { createContext } from 'react';
import { FAMILLE } from './charte';

export type Icones = 'points' | 'trait';
export type Couleurs = 'spectre' | 'familles';

export interface Apparence { icones: Icones; couleurs: Couleurs }

export const APPARENCE_PAR_DEFAUT: Apparence = { icones: 'points', couleurs: 'familles' };

/** Spectre : tout en gris, la lumière pour ce qui fait agir le robot, l'ambre pour ce qui demande quelqu'un. */
const SPECTRE: Record<string, string> = {
  declencheur: '#c9ced6', robot: '#ffffff', deplacement: '#ffffff', perception: '#c9ced6', logique: '#c9ced6',
  donnees: '#9aa3ae', temps: '#9aa3ae', operateur: '#ffb02e', fin: '#c9ced6',
};

/** La couleur d'une famille dans l'apparence choisie. */
export function teinte(famille: string, couleurs: Couleurs): string {
  return couleurs === 'spectre' ? SPECTRE[famille] ?? '#c9ced6' : FAMILLE[famille].couleur;
}

export const ApparenceContexte = createContext<{ apparence: Apparence; changer(a: Partial<Apparence>): void }>({
  apparence: APPARENCE_PAR_DEFAUT, changer: () => {},
});
