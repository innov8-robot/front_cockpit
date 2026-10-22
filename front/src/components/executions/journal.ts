/**
 * Le journal d'une mission qui joue, comme la console du cockpit : ce qui s'est passé, dans l'ordre, avec le nom des
 * étapes. Il naît de la comparaison de deux relectures de l'exécution : une étape commence, une autre finit (réussie ou
 * ratée, et la sortie qu'elle prend), un tour passe, la mission se met en pause ou reprend, le pas à pas change, une
 * alerte arrive ; puis l'issue, lue dans le run.
 */
import { TYPES_PRIMITIVE } from '../../api/libelles';
import type { EtapeJouee, Execution, Mission, Primitive, Run } from '../../api/types';
import { nomDuNoeud, typeDuNoeud } from '../graphe/correspondance';
import { FAMILLE, SORTIES } from '../missions/charte';
import { duree } from './donnees';

export type SorteEntree = 'lancement' | 'tour' | 'debut' | 'fin' | 'alerte' | 'pause' | 'reprise' | 'pasapas' | 'issue';

/** Une ligne du journal : quand (temps joué, s), quoi, et de quel ton. */
export interface EntreeJournal {
  id: number;
  t: number;
  sorte: SorteEntree;
  texte: string;
  /** Ce qu'on lit à droite : le genre d'une étape qui commence, la sortie prise par une étape qui finit. */
  detail?: string;
  ton: 'vit' | 'ok' | 'attention' | 'erreur' | 'neutre';
}

type Brouillon = Omit<EntreeJournal, 'id'>;

/** Le nom et le genre d'une étape. */
function etape(m: Mission, primitives: Primitive[], noeud: string): { nom: string; genre: string } {
  const parId = new Map(primitives.map((p) => [p.id, p]));
  const n = m.noeuds.find((x) => x.id === noeud);
  if (!n) return { nom: 'Étape supprimée', genre: '' };
  const p = n.primitiveId ? parId.get(n.primitiveId) : undefined;
  return { nom: nomDuNoeud(n, parId), genre: p ? TYPES_PRIMITIVE[p.type].libelle : FAMILLE[typeDuNoeud(n, parId).famille]?.nom ?? '' };
}

/** Une étape commence. */
const debut = (m: Mission, primitives: Primitive[], j: EtapeJouee, t: number): Brouillon => {
  const e = etape(m, primitives, j.noeud);
  return { t, sorte: 'debut', texte: e.nom, detail: e.genre, ton: 'vit' };
};

/** Une étape finit : réussie ou ratée, en combien de temps, et par quelle sortie la mission la quitte. */
function fin(j: EtapeJouee, issue: 'reussi' | 'echoue', suivante: EtapeJouee | undefined, t: number): Brouillon {
  const d = j.debutS !== undefined ? duree(t - j.debutS) : null;
  const sortie = suivante ? SORTIES[suivante.par]?.libelle : null;
  return {
    t, sorte: 'fin', ton: issue === 'reussi' ? 'ok' : 'attention',
    texte: issue === 'reussi' ? `réussie${d ? ` en ${d}` : ''}` : `ratée${d ? ` après ${d}` : ''}`,
    detail: sortie ? `→ ${sortie}` : undefined,
  };
}

/** Les étapes d'un tour à partir de la `k`-ième : leur début, et la fin de celles qui sont finies. */
function etapes(m: Mission, primitives: Primitive[], x: Execution, k: number): Brouillon[] {
  const joues = x.joues ?? [];
  const sorties: Brouillon[] = [];
  for (let i = k; i < joues.length; i++) {
    const j = joues[i];
    sorties.push(debut(m, primitives, j, j.debutS ?? x.dureeS));
    if (j.issue !== 'cours') sorties.push(fin(j, j.issue, joues[i + 1], joues[i + 1]?.debutS ?? x.dureeS));
  }
  return sorties;
}

/**
 * Ce qui s'est passé entre deux relectures de l'exécution (`avant` est null à la première) : les lignes à ajouter au
 * journal, dans l'ordre.
 */
export function journaliser(avant: Execution | null, apres: Execution, m: Mission, primitives: Primitive[]): Brouillon[] {
  const lignes: Brouillon[] = [];
  const t = apres.dureeS;
  if (!avant) {
    lignes.push({ t: 0, sorte: 'lancement', texte: `Lancement · ${m.nom}`, detail: apres.repetitions > 1 ? `${apres.repetitions} tours` : undefined, ton: 'vit' });
    if (apres.repetitions > 1) lignes.push({ t: apres.joues?.[0]?.debutS ?? t, sorte: 'tour', texte: `Tour ${apres.repetition}/${apres.repetitions}`, ton: 'neutre' });
    lignes.push(...etapes(m, primitives, apres, 0));
  } else if (apres.repetition !== avant.repetition) {
    const ouverte = avant.joues?.at(-1);
    const debutTour = apres.joues?.[0]?.debutS ?? t;
    if (ouverte?.issue === 'cours') lignes.push(fin(ouverte, 'reussi', undefined, debutTour));
    lignes.push({ t: debutTour, sorte: 'tour', texte: `Tour ${apres.repetition}/${apres.repetitions}`, ton: 'neutre' });
    lignes.push(...etapes(m, primitives, apres, 0));
  } else {
    const a = avant.joues ?? [];
    const b = apres.joues ?? [];
    const ouverte = a.at(-1);
    if (ouverte?.issue === 'cours' && b.length > a.length) {
      const j = b[a.length - 1];
      lignes.push(fin(j, j.issue === 'echoue' ? 'echoue' : 'reussi', b[a.length], b[a.length]?.debutS ?? t));
    }
    lignes.push(...etapes(m, primitives, apres, a.length));
  }
  if (avant && apres.enPause !== avant.enPause) {
    lignes.push(apres.enPause ? { t, sorte: 'pause', texte: 'Pause', ton: 'neutre' } : { t, sorte: 'reprise', texte: 'Reprise', ton: 'vit' });
  }
  if (avant && Boolean(apres.pasAPas) !== Boolean(avant.pasAPas)) {
    lignes.push({ t, sorte: 'pasapas', texte: apres.pasAPas ? 'Pas à pas : une pause à la fin de chaque étape' : 'Pas à pas quitté', ton: 'neutre' });
  }
  if (apres.alerte && apres.alerte.texte !== avant?.alerte?.texte) {
    lignes.push({ t, sorte: 'alerte', texte: apres.alerte.texte, ton: apres.alerte.niveau === 'erreur' ? 'erreur' : 'attention' });
  }
  return lignes;
}

/**
 * La fin de la mission, lue dans son run : l'étape encore ouverte se ferme (réussie, ou ratée sur une erreur ; un arrêt
 * la laisse ouverte), puis l'issue, dernière ligne du journal.
 */
export function clore(avant: Execution, run: Run): Brouillon[] {
  const t = run.dureeS;
  const ouverte = avant.joues?.at(-1);
  const lignes: Brouillon[] = [];
  if (ouverte?.issue === 'cours' && run.issue !== 'interrompu') lignes.push(fin(ouverte, run.issue === 'reussi' ? 'reussi' : 'echoue', undefined, t));
  if (run.issue === 'reussi') lignes.push({ t, sorte: 'issue', texte: `Mission terminée en ${duree(t)}`, ton: 'ok' });
  else if (run.issue === 'echoue') lignes.push({ t, sorte: 'issue', texte: `Erreur : ${run.cause ?? 'la mission s’est arrêtée'}`, ton: 'erreur' });
  else lignes.push({ t, sorte: 'issue', texte: /urgence/i.test(run.cause ?? '') ? 'Arrêt d’urgence' : 'Arrêtée par l’opérateur', ton: 'erreur' });
  return lignes;
}
