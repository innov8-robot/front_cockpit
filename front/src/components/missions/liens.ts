/** Les liens du canevas de mission : leurs données, leur couleur, et leur tracé quand ils reviennent en arrière. */
import type { Edge } from '@xyflow/react';
import { SORTIES, type EtatLien, type Sortie, type Ton } from './charte';

export type DonneesLien = { sortie: Sortie; etat?: EtatLien; ton?: Ton };
export type LienCanevas = Edge<DonneesLien, 'pulse'>;

/** La couleur de l'onde d'un lien : l'issue de sa sortie ; un choix (alors, sinon, faire) n'en est pas une. */
export function tonDe(s: Sortie): Ton {
  if (s === 'echec') return 'echec';
  return ['faire', 'alors', 'sinon', 'cas1', 'cas2', 'autre'].includes(s) ? 'neutre' : 'ok';
}

/** Un lien qui revient en arrière — la fin d'un tour vers l'entrée de sa boucle — passe sous les nœuds, comme dans n8n. */
export function cheminRetour(sx: number, sy: number, tx: number, ty: number) {
  const bas = Math.max(sy, ty) + 96;
  const r = 12;
  const a = sx + 24;
  const b = tx - 24;
  const m = (a + b) / 2;
  return {
    d: `M${sx} ${sy}H${a - r}Q${a} ${sy} ${a} ${sy + r}V${bas - r}Q${a} ${bas} ${a - r} ${bas}H${b + r}Q${b} ${bas} ${b} ${bas - r}V${ty + r}Q${b} ${ty} ${b + r} ${ty}H${tx}`,
    fleche: `M${m + 5} ${bas - 5}L${m - 4} ${bas}L${m + 5} ${bas + 5}z`,
  };
}

/** Un lien selon sa sortie : gris pour le chemin, pointillé ambre pour l'échec ; ni flèche ni texte. */
export function lien(id: string, source: string, sortie: Sortie, target: string): LienCanevas {
  const s = SORTIES[sortie];
  return {
    id, source, target, sourceHandle: sortie, type: 'pulse', data: { sortie },
    style: { stroke: s.couleur, strokeWidth: 2, strokeDasharray: s.pointille ? '6 5' : undefined },
  };
}
