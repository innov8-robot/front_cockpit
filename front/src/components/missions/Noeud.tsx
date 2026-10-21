import { Handle, Position, useNodeConnections, type Node, type NodeProps } from '@xyflow/react';
import { Fragment, useContext, type MouseEvent, type ReactNode } from 'react';
import { Actions } from './actions';
import { ApparenceContexte, teinte } from './apparence';
import { ETATS, FAMILLE, SORTIES, type EtatNoeud, type Sortie } from './charte';
import { expression, ICONES, resumer, sortiesVisibles, type TypeNoeud } from './catalogue';
import { GRILLE, points } from './points';


/** L'icône d'un nœud, dans le carré de la couleur de sa famille. */
export function IconeNoeud({ nom, couleur, taille = 16 }: { nom: string; couleur: string; taille?: number }) {
  return (
    <span className="em-icone" style={{ color: couleur, borderColor: `${couleur}55`, background: `${couleur}18` }}>
      <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONES[nom] ?? ICONES.note} /></svg>
    </span>
  );
}

/** Un mot-clé de pseudocode : écrit tout en capitales dans le catalogue (SI, ALORS, POUR, À, JUSQU'À). */
const MOT_CLE = /^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ'’]+$/;

/** Le texte d'une phrase, ses mots-clés mis à part. */
function texte(m: string, cle: string): ReactNode[] {
  return m.split(/(\s+)/).map((mot, j) => (MOT_CLE.test(mot) ? <span key={`${cle}-${j}`} className="em-mot">{mot}</span> : mot));
}

/** La phrase du nœud, ses réglages en pastilles : « RÉPÉTER [3] FOIS » ; `modele` remplace la phrase du type. */
export function Phrase({ type, valeurs, modele }: { type: TypeNoeud; valeurs: Record<string, string | number>; modele?: string }) {
  const morceaux: ReactNode[] = [];
  (modele ?? type.phrase).split(/(\{[a-z0-9_]+\})/).forEach((m, i) => {
    const cle = m.match(/^\{([a-z0-9_]+)\}$/)?.[1];
    if (!cle) { if (m) morceaux.push(...texte(m, String(i))); return; }
    const r = type.reglages.find((x) => x.cle === cle);
    const v = valeurs[cle] ?? r?.defaut ?? '…';
    morceaux.push(<span key={i} className={`em-pastille ${r?.type === 'condition' ? 'em-pastille-question' : ''}`}>
      {v}{r?.unite ? ` ${r.unite}` : ''}</span>);
  });
  return <span className="em-phrase">{morceaux}</span>;
}

/** L'état d'exécution en haut à droite : un rond qui tourne pendant l'étape, puis ✓, ! ou ■. */
export function BadgeEtat({ etat }: { etat?: EtatNoeud }) {
  if (!etat || etat === 'attente' || etat === 'saute') return null;
  const e = ETATS[etat];
  if (etat === 'cours') return <span className="em-chargement" role="status" aria-label={e.libelle} />;
  return <span className="em-badge-etat" title={e.libelle} aria-label={e.libelle}>{e.icone}</span>;
}

/** Une icône en points, comme la matrice du logo de démarrage : les points allumés dessinent l'icône, les autres veillent. */
export function IconePoints({ d, taille = 42 }: { d: string; taille?: number }) {
  return (
    <svg className="em-points" width={taille} height={taille} viewBox={`0 0 ${GRILLE} ${GRILLE}`} aria-hidden="true">
      {points(d).map((allume, k) => (
        <circle key={k} cx={(k % GRILLE) + 0.5} cy={Math.floor(k / GRILLE) + 0.5} r={allume ? 0.36 : 0.14} className={allume ? 'em-point' : 'em-point-eteint'} />
      ))}
    </svg>
  );
}

/** L'expression d'un nœud de logique, en pastille : hexagonale pour une condition, comme les booléens de Scratch. */
function Expression({ texte, condition, verdict }: { texte: string; condition: boolean; verdict?: string }) {
  return (
    <div className={`em-tuile-expr ${condition ? 'em-tuile-condition' : ''} ${verdict ? `em-verdict-${verdict}` : ''}`}>
      <span>{texte}{verdict && <b>{verdict}</b>}</span>
    </div>
  );
}

/** Le badge des nœuds qui font bouger le robot : quatre flèches, sans texte. */
function BadgeBouge() {
  return (
    <span className="em-badge-bouge" title="Fait bouger le robot" aria-label="Fait bouger le robot">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" /></svg>
    </span>
  );
}

/** Le nom d'une sortie : celui de la charte, ou la valeur du cas pour « selon ». */
function nomSortie(type: TypeNoeud, valeurs: Record<string, string | number>, s: Sortie): string {
  if (s === 'cas1' || s === 'cas2') return String(valeurs[s] ?? type.reglages.find((r) => r.cle === s)?.defaut ?? s);
  return SORTIES[s].libelle;
}

/** Ce que le nœud vit pendant l'exécution, à la place de son résumé : « tour 2 », « i = 3 », « essai 2/2 ». */
export interface Direct { texte: string; relance?: boolean }

export interface ProprietesCarte {
  type: TypeNoeud;
  valeurs?: Record<string, string | number>;
  etat?: EtatNoeud;
  choisi?: boolean;
  desactive?: boolean;
  /** La sortie « échec » est ouverte (le réglage « si ça rate » de n8n). */
  echec?: boolean;
  direct?: Direct;
  /** La sortie que le nœud vient de prendre (alors, sinon, faire, fini). */
  prise?: string;
  /** Une boucle qui attend la fin de son tour : elle tourne, mais le rond de chargement reste à l'étape en cours. */
  veille?: boolean;
  /** Les poignées de React Flow ; sans elles, la carte est une image (galerie). */
  poignees?: boolean;
  /** Les sorties libres, qui portent un « + », et ce qu'il fait. */
  libres?: string[];
  surPlus?: (sortie: string, e: MouseEvent) => void;
}

/**
 * Un nœud de mission, comme dans n8n : une tuile et son icône, le nom dessous, un résumé de ses réglages. Les sorties
 * à droite portent leur nom quand il y en a plusieurs (alors / sinon, fini / faire) et un « + » quand elles sont libres.
 * Un déclencheur a le bord gauche arrondi, une fin le bord droit.
 */
export function CarteNoeud({ type, valeurs = {}, etat, choisi, desactive, echec, direct, prise, veille, poignees, libres, surPlus }: ProprietesCarte) {
  const { apparence } = useContext(ApparenceContexte);
  const f = FAMILLE[type.famille];
  const sorties = sortiesVisibles(type, echec);
  const hauteur = (i: number) => `${(100 / (sorties.length + 1)) * (i + 1)}%`;
  const expr = expression(type, valeurs);
  const resume = expr ? direct?.texte : direct?.texte ?? resumer(type, valeurs);
  const verdict = prise === 'alors' ? 'oui' : prise === 'sinon' ? 'non' : undefined;
  const d = ICONES[type.icone] ?? ICONES.note;
  return (
    <div className={`em-tuile em-forme-${f.forme} ${choisi ? 'choisi' : ''} ${etat ? `em-etat-${etat}` : ''} ${veille ? 'em-veille' : ''} ${desactive ? 'em-desactive' : ''}`}
      style={{ ['--famille' as string]: teinte(type.famille, apparence.couleurs), ['--etat' as string]: etat ? ETATS[etat].couleur : 'transparent' }} title={type.aide}>
      {type.famille === 'declencheur' && (
        <svg className="em-eclair" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONES.eclair} /></svg>
      )}
      {apparence.icones === 'points' ? <IconePoints d={d} /> : (
        <svg className="em-tuile-icone" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
      )}
      <BadgeEtat etat={veille ? undefined : etat} />
      {type.bouge && <BadgeBouge />}
      {poignees && type.entree && <Handle type="target" position={Position.Left} className="em-poignee" />}
      {sorties.map((s, i) => (
        <Fragment key={s}>
          {poignees && <Handle type="source" position={Position.Right} id={s} className={`em-poignee em-poignee-${s}`} style={{ top: hauteur(i) }} />}
          {libres?.includes(s) && (
            <span className="em-bout" style={{ top: hauteur(i) }}>
              <button className="em-plus nodrag" onClick={(e) => surPlus?.(s, e)} aria-label={`Ajouter après « ${SORTIES[s].libelle || 'la suite'} »`}>+</button>
            </span>
          )}
          {sorties.length > 1 && <span className={`em-sortie-nom em-sortie-${s} ${prise === s ? 'em-sortie-prise' : ''}`} style={{ top: hauteur(i) }}>{nomSortie(type, valeurs, s)}</span>}
        </Fragment>
      ))}
      <div className="em-tuile-nom">{type.nom}</div>
      {expr && <Expression texte={expr.texte} condition={expr.condition} verdict={verdict} />}
      {resume && <div className={`em-tuile-resume ${expr ? 'em-tuile-sous-expr' : ''} ${direct ? 'em-tuile-direct' : ''} ${direct?.relance ? 'em-tuile-relance' : ''}`}>{resume}</div>}
    </div>
  );
}

/** Les données d'un nœud du prototype. */
export type DonneesNoeud = {
  type: TypeNoeud;
  valeurs: Record<string, string | number>;
  etat?: EtatNoeud;
  echec?: boolean;
  direct?: Direct;
  prise?: string;
  veille?: boolean;
  desactive?: boolean;
};

export type NoeudMission = Node<DonneesNoeud, 'carte' | 'vide'>;

/** Le nœud ordinaire de React Flow : ses sorties sans lien portent un « + ». */
export function NoeudCarte({ id, data, selected }: NodeProps<NoeudMission>) {
  const actions = useContext(Actions);
  const liens = useNodeConnections({ handleType: 'source' });
  const prises = new Set(liens.map((l) => l.sourceHandle));
  const libres = sortiesVisibles(data.type, data.echec).filter((s) => !prises.has(s));
  return (
    <CarteNoeud {...data} choisi={selected} poignees libres={libres}
      surPlus={(s, e) => { e.stopPropagation(); actions?.ajouter(id, s, { x: e.clientX, y: e.clientY }); }} />
  );
}

/** La case à remplir, comme le « Replace Me » de n8n : posée dans une boucle neuve, on clique pour choisir son étape. */
export function NoeudVide({ id }: NodeProps<NoeudMission>) {
  const actions = useContext(Actions);
  return (
    <button className="em-tuile em-tuile-vide nodrag" onClick={(e) => { e.stopPropagation(); actions?.remplacer(id, { x: e.clientX, y: e.clientY }); }}>
      <Handle type="target" position={Position.Left} className="em-poignee" />
      <span aria-hidden="true">+</span>
      <Handle type="source" position={Position.Right} id="suite" className="em-poignee" />
      <div className="em-tuile-nom">Choisir l’étape</div>
    </button>
  );
}
