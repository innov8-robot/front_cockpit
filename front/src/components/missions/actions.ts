import { createContext } from 'react';

/** Où l'on a cliqué, en coordonnées de l'écran : le menu qui choisit le nœud s'ouvre là. */
export interface Point { x: number; y: number }

/** Ce que les nœuds du canevas demandent à l'éditeur : ajouter un nœud au bout d'une sortie libre, remplir un nœud vide. */
export interface ActionsCanevas {
  ajouter(id: string, sortie: string, ou: Point): void;
  remplacer(id: string, ou: Point): void;
}

export const Actions = createContext<ActionsCanevas | null>(null);
