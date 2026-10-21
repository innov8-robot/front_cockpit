/**
 * Le pont entre la mission de l'API (des primitives et des nœuds du catalogue — logique, opérateur, fin — reliés par
 * leurs sorties) et le canevas de l'éditeur de missions : un nœud devient une tuile du catalogue, une mission devient
 * des nœuds et des liens, et l'exécution en cours devient l'état de chacun.
 */
import { TYPES_PRIMITIVE } from '../../api/libelles';
import type { Execution, LienMission, NoeudMission, Primitive, Sortie as SortieMission, TypePrimitive } from '../../api/types';
import type { EtatLien, EtatNoeud, Sortie } from '../missions/charte';
import { CATALOGUE, resumer, typeNoeud, type TypeNoeud } from '../missions/catalogue';
import { lien, type LienCanevas } from '../missions/liens';
import type { Direct, NoeudMission as NoeudCanevas } from '../missions/Noeud';

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

/** Le départ d'une mission : ni primitive, ni nœud du catalogue. */
export const estDepart = (n: NoeudMission) => n.primitiveId === null && !n.type;

/** Le type d'un nœud de mission : sa primitive, son nœud du catalogue, ou le déclencheur du départ. */
export function typeDuNoeud(n: NoeudMission, parId: Map<string, Primitive>): TypeNoeud {
  if (n.type) return CATALOGUE.find((t) => t.cle === n.type) ?? typePrimitive(undefined);
  return n.primitiveId === null ? typeNoeud('au_lancement') : typePrimitive(parId.get(n.primitiveId));
}

/**
 * Le nom d'un nœud de mission : celui de sa primitive, ou son type et son résumé (« Si · bac plein ? ») ; un appel à
 * l'opérateur dit seulement ce qu'on lui demande (« Opérateur · Videz le bac »).
 */
export function nomDuNoeud(n: NoeudMission, parId: Map<string, Primitive>): string {
  if (n.primitiveId) return parId.get(n.primitiveId)?.nom ?? 'Primitive supprimée';
  if (!n.type) return 'Lancement';
  const t = typeDuNoeud(n, parId);
  const r = resumer(t, n.valeurs);
  const titre = t.famille === 'operateur' ? 'Opérateur' : t.nom;
  return r ? `${titre} · ${r}` : titre;
}

/** Les sorties que l'API connaît ; les autres, et la « suite » du départ, redeviennent « réussi ». */
const SORTIES_API: SortieMission[] = ['ok', 'echec', 'suite', 'alors', 'sinon', 'faire', 'fini'];

/**
 * La poignée d'une sortie sur le canevas. L'API relie le départ par « ok » ; sa tuile, un déclencheur, n'a qu'une
 * sortie, « suite » : sans cette traduction, React Flow ne trouve pas la poignée et le lien ne se dessine pas.
 */
export function poignee(source: string, sortie: Sortie): Sortie {
  return source === 'depart' && sortie !== 'echec' ? 'suite' : sortie;
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
      id: n.id, type: 'carte', position: { x: n.x, y: n.y }, deletable: !estDepart(n),
      data: {
        type: typeDuNoeud(n, parId),
        valeurs: n.type ? n.valeurs ?? {} : n.primitiveId ? { primitive: n.primitiveId } : {}, echec: avecEchec.has(n.id),
      },
    })),
    edges: liens.map((l) => lien(l.id, l.de, poignee(l.de, l.sortie), l.vers)),
  };
}

/** La mission de l'API pour les nœuds et les liens du canevas. */
export function versMission(nodes: NoeudCanevas[], edges: LienCanevas[]): { noeuds: NoeudMission[]; liens: LienMission[] } {
  return {
    noeuds: nodes.map((n): NoeudMission => {
      const ici = { id: n.id, x: Math.round(n.position.x), y: Math.round(n.position.y) };
      const primitive = String(n.data.valeurs.primitive ?? '');
      if (n.id === 'depart') return { ...ici, primitiveId: null };
      return primitive ? { ...ici, primitiveId: primitive } : { ...ici, primitiveId: null, type: n.data.type.cle, valeurs: n.data.valeurs };
    }),
    liens: edges.map((e) => {
      const s = e.data?.sortie as SortieMission | undefined;
      const sortie = s && SORTIES_API.includes(s) && e.source !== 'depart' ? s : 'ok';
      return { id: e.id, de: e.source, sortie, vers: e.target };
    }),
  };
}

/**
 * L'état de chaque nœud et de chaque lien pendant une exécution : le chemin joué (une étape ratée en échec), l'étape
 * en cours, ce qu'on prévoit.
 */
export function etatsExecution(x: Execution, edges: LienCanevas[]) {
  const noeuds = new Map<string, EtatNoeud>();
  const ratees = new Set((x.joues ?? []).filter((j) => j.issue === 'echoue').map((j) => j.noeud));
  x.chemin.forEach((id, i) => noeuds.set(id, ratees.has(id) ? 'echec' : i < x.etape ? 'ok' : i === x.etape ? 'cours' : 'attente'));
  const liens = new Map<string, 'parcouru' | 'actif'>();
  for (let i = 1; i <= x.etape && i < x.chemin.length; i++) {
    const l = edges.find((e) => e.source === x.chemin[i - 1] && e.target === x.chemin[i]);
    if (l) liens.set(l.id, i === x.etape ? 'actif' : 'parcouru');
  }
  return { noeuds, liens };
}

/** L'état d'un run sur le canevas : chaque nœud et chaque lien, et ce que chaque tuile affiche sous son nom. */
export interface Trace {
  noeuds: Map<string, EtatNoeud>;
  liens: Map<string, EtatLien>;
  directs: Map<string, Direct>;
}
