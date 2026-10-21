/**
 * Le pont entre la mission de l'API (des primitives reliées par « réussi » / « échoué ») et le canevas de l'éditeur de
 * missions : une primitive devient une tuile du catalogue, une mission devient des nœuds et des liens, et l'exécution
 * en cours devient l'état de chacun.
 */
import { TYPES_PRIMITIVE } from '../../api/libelles';
import type { Execution, LienMission, NoeudMission, Primitive, TypePrimitive } from '../../api/types';
import type { EtatNoeud } from '../missions/charte';
import { typeNoeud, type TypeNoeud } from '../missions/catalogue';
import { lien, type LienCanevas } from '../missions/liens';
import type { NoeudMission as NoeudCanevas } from '../missions/Noeud';

const FAMILLE: Record<TypePrimitive, string> = {
  prise_objet: 'robot', prise_boite: 'robot', depose: 'robot', deplacer: 'deplacement', rentrer: 'deplacement',
};
const ICONE: Record<TypePrimitive, string> = {
  prise_objet: 'prendre', prise_boite: 'bac', depose: 'deposer', deplacer: 'rouler', rentrer: 'rentrer',
};

/** La tuile d'une primitive : son nom dessus, son type et son taux de réussite dessous. */
export function typePrimitive(p: Primitive | undefined): TypeNoeud {
  if (!p) {
    return {
      cle: 'supprimee', famille: 'temps', nom: 'Primitive supprimée', phrase: '', icone: 'note', sorties: ['ok', 'echec'],
      entree: true, reglages: [], statut: 'existe', aide: 'La primitive de ce nœud n’existe plus : remplacez-la ou retirez le nœud.',
    };
  }
  const taux = p.tauxReussite === null ? '' : ` · ${Math.round(p.tauxReussite * 100)} %`;
  return {
    cle: p.id, famille: FAMILLE[p.type], nom: p.nom, phrase: p.nom, resume: `${TYPES_PRIMITIVE[p.type].libelle}${taux}`,
    icone: ICONE[p.type], sorties: ['ok', 'echec'], entree: true, reglages: [], statut: 'existe', bouge: true, aide: p.description,
  };
}

/** Les nœuds qu'on atteint depuis le départ : les autres ne seront jamais joués. */
export function atteignables(liens: { source: string; target: string }[]): Set<string> {
  const vus = new Set(['depart']);
  const pile = ['depart'];
  while (pile.length) {
    const n = pile.pop()!;
    for (const l of liens) if (l.source === n && !vus.has(l.target)) { vus.add(l.target); pile.push(l.target); }
  }
  return vus;
}

/** Les nœuds et les liens du canevas pour une mission de l'API. */
export function versCanevas(noeuds: NoeudMission[], liens: LienMission[], parId: Map<string, Primitive>): { nodes: NoeudCanevas[]; edges: LienCanevas[] } {
  const avecEchec = new Set(liens.filter((l) => l.sortie === 'echec').map((l) => l.de));
  return {
    nodes: noeuds.map((n) => ({
      id: n.id, type: 'carte', position: { x: n.x, y: n.y }, deletable: n.primitiveId !== null,
      data: {
        type: n.primitiveId === null ? typeNoeud('au_lancement') : typePrimitive(parId.get(n.primitiveId)),
        valeurs: n.primitiveId ? ({ primitive: n.primitiveId } as Record<string, string>) : {}, echec: avecEchec.has(n.id),
      },
    })),
    edges: liens.map((l) => lien(l.id, l.de, l.sortie, l.vers)),
  };
}

/** La mission de l'API pour les nœuds et les liens du canevas. */
export function versMission(nodes: NoeudCanevas[], edges: LienCanevas[]): { noeuds: NoeudMission[]; liens: LienMission[] } {
  return {
    noeuds: nodes.map((n) => ({
      id: n.id, primitiveId: n.id === 'depart' ? null : String(n.data.valeurs.primitive ?? '') || null,
      x: Math.round(n.position.x), y: Math.round(n.position.y),
    })),
    liens: edges.map((e) => ({ id: e.id, de: e.source, sortie: e.data?.sortie === 'echec' ? 'echec' : 'ok', vers: e.target })),
  };
}

/** L'état de chaque nœud et de chaque lien pendant une exécution : le chemin joué, l'étape en cours, son avancement. */
export function etatsExecution(x: Execution, edges: LienCanevas[]) {
  const noeuds = new Map<string, EtatNoeud>();
  x.chemin.forEach((id, i) => noeuds.set(id, i < x.etape ? 'ok' : i === x.etape ? 'cours' : 'attente'));
  const liens = new Map<string, 'parcouru' | 'actif'>();
  for (let i = 1; i <= x.etape && i < x.chemin.length; i++) {
    const l = edges.find((e) => e.source === x.chemin[i - 1] && e.target === x.chemin[i]);
    if (l) liens.set(l.id, i === x.etape ? 'actif' : 'parcouru');
  }
  return { noeuds, liens };
}
