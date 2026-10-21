/**
 * Les exécutions d'une mission vues par l'éditeur : un run rejoué sur le canevas, et ce que l'analyse en tire —
 * réussite et durée par étape, causes d'échec. Tout vient de `Run.etapes`, le détail par étape servi par le back.
 */
import type { IssueRun, Mission, Primitive, Run } from '../../api/types';
import type { EtatNoeud } from '../missions/charte';
import type { Trace } from '../graphe/correspondance';

export const duree = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** L'issue d'un run en mots, avec l'icône qui l'accompagne toujours (la couleur seule ne dit rien). */
export const ISSUES: Record<IssueRun, { libelle: string; icone: string }> = {
  reussi: { libelle: 'Réussie', icone: '✓' },
  echoue: { libelle: 'Échouée', icone: '!' },
  interrompu: { libelle: 'Interrompue', icone: '■' },
};

/** Quand un run a commencé : « aujourd'hui 14:32 », « hier 09:10 », ou la date. */
export function quand(iso: string): string {
  const d = new Date(iso);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const jours = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  if (jours === 0) return `aujourd’hui ${heure}`;
  if (jours === 1) return `hier ${heure}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${heure}`;
}

/** L'état d'une étape sur le canevas : un arrêt d'urgence est un danger, une autre interruption reste neutre. */
function etatEtape(issue: IssueRun, cause: string | null): EtatNoeud {
  if (issue === 'reussi') return 'ok';
  if (issue === 'echoue') return 'echec';
  return /urgence/i.test(cause ?? '') ? 'danger' : 'attente';
}

/** Un run rejoué sur le canevas : les étapes jouées et leur issue, les liens pris, la durée sous chaque tuile. */
export function traceDe(r: Run, m: Mission): Trace {
  const trace: Trace = { noeuds: new Map([['depart', 'ok']]), liens: new Map(), directs: new Map() };
  let prec = 'depart';
  for (const e of r.etapes ?? []) {
    trace.noeuds.set(e.noeud, etatEtape(e.issue, e.cause));
    const lien = m.liens.find((l) => l.de === prec && l.vers === e.noeud);
    if (lien) trace.liens.set(lien.id, 'parcouru');
    trace.directs.set(e.noeud, {
      texte: e.issue === 'reussi' ? duree(e.dureeS) : `${ISSUES[e.issue].libelle.toLowerCase()} · ${duree(e.dureeS)}`,
      relance: e.issue === 'echoue',
    });
    prec = e.noeud;
  }
  return trace;
}

/** Le nom d'une étape : celui de la primitive de son nœud. */
export function nomEtape(m: Mission, primitives: Primitive[], noeud: string): string {
  const id = m.noeuds.find((n) => n.id === noeud)?.primitiveId;
  return primitives.find((p) => p.id === id)?.nom ?? 'Primitive supprimée';
}

/** Ce qu'une étape a donné sur une série de runs. */
export interface StatEtape { noeud: string; joues: number; reussis: number; dureeMoyS: number }

/** Réussite et durée moyenne de chaque étape jouée, dans l'ordre où la mission les joue. */
export function statsParEtape(runs: Run[]): StatEtape[] {
  const par = new Map<string, { joues: number; reussis: number; somme: number; rang: number }>();
  for (const r of runs) {
    (r.etapes ?? []).forEach((e, i) => {
      const s = par.get(e.noeud) ?? { joues: 0, reussis: 0, somme: 0, rang: i };
      s.joues += 1;
      s.reussis += e.issue === 'reussi' ? 1 : 0;
      s.somme += e.dureeS;
      s.rang = Math.min(s.rang, i);
      par.set(e.noeud, s);
    });
  }
  return [...par.entries()].sort((a, b) => a[1].rang - b[1].rang)
    .map(([noeud, s]) => ({ noeud, joues: s.joues, reussis: s.reussis, dureeMoyS: s.somme / s.joues }));
}

/** Les causes des runs qui n'ont pas réussi, de la plus fréquente à la plus rare, avec la dernière fois. */
export function causes(runs: Run[]): { cause: string; issue: IssueRun; nombre: number; derniere: string }[] {
  const par = new Map<string, { issue: IssueRun; nombre: number; derniere: string }>();
  for (const r of runs) {
    if (r.issue === 'reussi') continue;
    const cle = r.cause ?? 'Sans cause';
    const c = par.get(cle) ?? { issue: r.issue, nombre: 0, derniere: r.debut };
    c.nombre += 1;
    if (r.debut > c.derniere) c.derniere = r.debut;
    par.set(cle, c);
  }
  return [...par.entries()].map(([cause, c]) => ({ cause, ...c })).sort((a, b) => b.nombre - a.nombre);
}

/** Un pas d'axe lisible pour une durée totale : environ cinq graduations rondes. */
export function pasAxe(totalS: number): number {
  return [5, 10, 15, 20, 30, 60, 120, 300].find((p) => totalS / p <= 6) ?? 600;
}
