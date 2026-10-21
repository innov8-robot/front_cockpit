import {
  addEdge, Background, BackgroundVariant, BaseEdge, Controls, getBezierPath, MiniMap, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type EdgeProps, type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { Actions, type ActionsCanevas, type Point } from './actions';
import { FAMILLE, FAMILLES, SORTIES, STATUTS, TONS, type EtatLien, type EtatNoeud, type Sortie, type Ton } from './charte';
import { CATALOGUE, sortiesVisibles, typeNoeud, type TypeNoeud } from './catalogue';
import { IconeNoeud, NoeudCarte, NoeudVide, type DonneesNoeud, type Direct, type NoeudMission } from './Noeud';
import { Flux, useFlux } from './flux';
import { OndeChemin } from './Onde';

/** Un pas de la simulation dure un peu plus d'une période de l'onde (1 Hz) : on la voit passer au moins une fois. */
const PAS_MS = 1100;
const GLISSE = 'application/x-noeud-mission';
/** L'écart entre deux colonnes de nœuds, et entre deux rangées. */
const COLONNE = 180;
const RANGEE = 120;

type DonneesLien = { sortie: Sortie; etat?: EtatLien; ton?: Ton };
type LienMission = Edge<DonneesLien, 'pulse'>;

/** La couleur du flux d'un lien : ambre s'il part d'un échec, vert sur tout le chemin validé. */
function tonDe(s: Sortie): Ton {
  return s === 'echec' ? 'echec' : 'ok';
}

/** Un lien qui revient en arrière — la fin d'un tour vers l'entrée de sa boucle — passe sous les nœuds, comme dans n8n. */
function cheminRetour(sx: number, sy: number, tx: number, ty: number) {
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

/**
 * Un lien de mission : une courbe vers l'avant, un retour par-dessous. Parcouru, une lueur de son issue ; l'onde du
 * parcours (flux.ts) y passe quand il est sur le chemin pris. À l'arrêt d'urgence, le lien qui menait à l'étape en
 * cours porte une onde rouge.
 */
function LienPulse({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }: EdgeProps<LienMission>) {
  const retour = targetX < sourceX + 20 ? cheminRetour(sourceX, sourceY, targetX, targetY) : null;
  const d = retour?.d ?? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })[0];
  const etat = data?.etat ?? 'aucun';
  const urgence = etat === 'actif' && data?.ton === 'danger';
  const flux = useContext(Flux);
  const tete = useRef<SVGPathElement>(null);
  const traine = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    flux?.inscrire(id, { longueur: tete.current?.getTotalLength() ?? 0, tete: tete.current, traine: traine.current });
    return () => flux?.desinscrire(id);
  }, [d, flux, id]);
  const couleur = TONS[data?.sortie === 'echec' ? 'echec' : 'ok'];
  return (
    <>
      <BaseEdge id={id} path={d} style={{ ...style, opacity: etat === 'aucun' ? 0.75 : 1 }} />
      {retour && <path d={retour.fleche} fill={String(style?.stroke ?? '#9aa3ae')} />}
      <OndeChemin d={d} etat={urgence ? 'actif' : etat === 'aucun' ? 'aucun' : 'parcouru'} ton={data?.ton ?? 'neutre'} />
      <path ref={traine} d={d} className="em-flux em-flux-traine" style={{ stroke: couleur, color: couleur }} />
      <path ref={tete} d={d} className="em-flux" style={{ stroke: couleur, color: couleur }} />
    </>
  );
}

const TYPES_NOEUDS = { carte: NoeudCarte, vide: NoeudVide };
const TYPES_LIENS = { pulse: LienPulse };
/** La vue de départ cadre le début de la mission à une taille lisible ; la suite vient en suivant l'exécution. */
const VUE_DE_DEPART = { nodes: [{ id: 'depart' }, { id: 'appel_bac' }, { id: 'prendre' }, { id: 'appel_prise' }], padding: 0.1, maxZoom: 1 };
const nouvelId = (prefixe: string) => `${prefixe}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Un lien selon sa sortie : gris pour le chemin, pointillé ambre pour l'échec ; ni flèche ni texte. */
function lien(id: string, source: string, sortie: Sortie, target: string): LienMission {
  const s = SORTIES[sortie];
  return {
    id, source, target, sourceHandle: sortie, type: 'pulse', data: { sortie },
    style: { stroke: s.couleur, strokeWidth: 2, strokeDasharray: s.pointille ? '6 5' : undefined },
  };
}

function carte(id: string, cle: string, x: number, y: number, valeurs = {}, plus: Partial<DonneesNoeud> = {}): NoeudMission {
  return { id, type: 'carte', position: { x, y }, data: { type: typeNoeud(cle), valeurs, ...plus } };
}

/**
 * La mission d'exemple, écrite avec le catalogue : « Vider la table dans le bac ». Pour chaque pièce sur la table : si le
 * bac est plein, appeler l'opérateur ; prendre la pièce (deux essais), la poser, compter, et revenir à la boucle ; une
 * pièce imprenable appelle l'opérateur, puis la boucle passe à la suivante. Quand il n'en reste plus : rentrer les bras
 * et aller à la base.
 */
function exemple(): { nodes: NoeudMission[]; edges: LienMission[] } {
  const c = (n: number) => n * COLONNE;
  const nodes: NoeudMission[] = [
    carte('depart', 'au_lancement', c(0), 200),
    carte('aller', 'deplacer', c(1), 200, { poste: 'table' }),
    carte('boucle', 'pour_chaque', c(2), 200, { objet: 'pièce', zone: 'la table' }),
    carte('si', 'si', c(3), 212, { condition: 'bac plein' }),
    carte('appel_bac', 'demander', c(4), 92, { message: 'Videz le bac' }),
    carte('prendre', 'prise_objet', c(5), 212, { primitive: 'pièce', essais: 2 }, { echec: true }),
    carte('poser', 'depose_objet', c(6), 200, { primitive: 'bac B' }),
    carte('compter', 'compteur', c(7), 200, { variable: 'déposées' }),
    carte('appel_prise', 'demander', c(6), 200 + 1.3 * RANGEE, { message: 'Retirez la pièce' }),
    carte('rentrer', 'rentrer', c(3), 200 - 2.3 * RANGEE),
    carte('base', 'deplacer', c(4), 200 - 2.3 * RANGEE, { poste: 'base' }),
    carte('fin', 'terminer', c(5), 200 - 2.3 * RANGEE, { verdict: 'réussie' }),
  ];
  const edges: LienMission[] = [
    lien('e1', 'depart', 'suite', 'aller'),
    lien('e2', 'aller', 'ok', 'boucle'),
    lien('e3', 'boucle', 'faire', 'si'),
    lien('e4', 'si', 'alors', 'appel_bac'),
    lien('e5', 'appel_bac', 'ok', 'prendre'),
    lien('e6', 'si', 'sinon', 'prendre'),
    lien('e7', 'prendre', 'ok', 'poser'),
    lien('e8', 'poser', 'ok', 'compter'),
    lien('e9', 'compter', 'suite', 'boucle'),
    lien('e10', 'prendre', 'echec', 'appel_prise'),
    lien('e11', 'appel_prise', 'ok', 'boucle'),
    lien('e12', 'boucle', 'fini', 'rentrer'),
    lien('e13', 'rentrer', 'ok', 'base'),
    lien('e14', 'base', 'ok', 'fin'),
  ];
  return { nodes, edges };
}

/** Un pas de la simulation : un nœud change d'état ; un lien s'allume vers lui ; une boucle change de tour, un geste d'essai. */
interface Pas { noeud: string; etat: EtatNoeud; lien?: string; tour?: number; essai?: number; prise?: string; remettre?: string[] }

/** Ce qu'un nouveau tour remet à zéro : l'état des étapes du corps ; le chemin déjà validé, lui, reste allumé. */
const CORPS = ['si', 'appel_bac', 'prendre', 'poser', 'compter', 'appel_prise'];

/** Deux pièces : la première passe ; la seconde rate ses deux essais, l'opérateur est appelé, la boucle n'en voit plus. */
const DEROULE: Pas[] = [
  { noeud: 'depart', etat: 'ok' },
  { noeud: 'aller', etat: 'cours', lien: 'e1' }, { noeud: 'aller', etat: 'ok' },
  { noeud: 'boucle', etat: 'cours', lien: 'e2', tour: 1, prise: 'faire' },
  { noeud: 'si', etat: 'cours', lien: 'e3' }, { noeud: 'si', etat: 'ok', prise: 'sinon' },
  { noeud: 'prendre', etat: 'cours', lien: 'e6', essai: 1 }, { noeud: 'prendre', etat: 'ok', prise: 'ok' },
  { noeud: 'poser', etat: 'cours', lien: 'e7' }, { noeud: 'poser', etat: 'ok' },
  { noeud: 'compter', etat: 'cours', lien: 'e8' }, { noeud: 'compter', etat: 'ok' },
  { noeud: 'boucle', etat: 'cours', lien: 'e9', tour: 2, prise: 'faire', remettre: CORPS },
  { noeud: 'si', etat: 'cours', lien: 'e3' }, { noeud: 'si', etat: 'ok', prise: 'sinon' },
  { noeud: 'prendre', etat: 'cours', lien: 'e6', essai: 1 }, { noeud: 'prendre', etat: 'echec' },
  { noeud: 'prendre', etat: 'cours', essai: 2 }, { noeud: 'prendre', etat: 'echec', prise: 'echec' },
  { noeud: 'appel_prise', etat: 'cours', lien: 'e10' }, { noeud: 'appel_prise', etat: 'ok' },
  { noeud: 'boucle', etat: 'cours', lien: 'e11' }, { noeud: 'boucle', etat: 'ok', prise: 'fini' },
  { noeud: 'rentrer', etat: 'cours', lien: 'e12' }, { noeud: 'rentrer', etat: 'ok' },
  { noeud: 'base', etat: 'cours', lien: 'e13' }, { noeud: 'base', etat: 'ok' },
  { noeud: 'fin', etat: 'cours', lien: 'e14' }, { noeud: 'fin', etat: 'ok' },
];

interface Instantane {
  /** Les liens pris, dans l'ordre : le chemin que l'onde parcourt du lancement à l'étape en cours. */
  parcours: string[];
  noeuds: Map<string, EtatNoeud>;
  /** Le dernier état d'une étape aux tours d'avant : à la fin, ce qui a été validé une fois le reste. */
  anciens: Map<string, EtatNoeud>;
  tours: Map<string, number>;
  essais: Map<string, number>;
  prises: Map<string, string>;
  liens: Map<string, EtatLien>;
}

/** L'état de la mission après `k` pas : chaque nœud et chaque lien à leur dernier état. */
function rejouer(k: number): Instantane {
  const e: Instantane = { parcours: [], noeuds: new Map(), anciens: new Map(), tours: new Map(), essais: new Map(), prises: new Map(), liens: new Map() };
  const eteindre = () => {
    for (const [id, x] of e.liens) if (x === 'actif') e.liens.set(id, 'parcouru');
  };
  for (const p of DEROULE.slice(0, k + 1)) {
    for (const id of p.remettre ?? []) {
      const avant = e.noeuds.get(id);
      if (avant) e.anciens.set(id, avant);
      for (const m of [e.noeuds, e.essais, e.prises]) m.delete(id);
    }
    if (p.lien) { eteindre(); e.liens.set(p.lien, 'actif'); e.parcours.push(p.lien); }
    e.noeuds.set(p.noeud, p.etat);
    if (p.tour) e.tours.set(p.noeud, p.tour);
    if (p.essai) e.essais.set(p.noeud, p.essai);
    if (p.prise) e.prises.set(p.noeud, p.prise);
  }
  if (k >= DEROULE.length - 1) eteindre();
  return e;
}

/** Ce que le nœud vit, sous son nom : le tour d'une boucle (i = 3 pour « pour »), l'essai d'un geste. */
function direct(n: NoeudMission, e: Instantane): Direct | undefined {
  const t = n.data.type;
  const tour = e.tours.get(n.id);
  if (tour && t.sorties.includes('faire')) {
    if (t.cle === 'pour') {
      const v = (cle: string) => n.data.valeurs[cle] ?? t.reglages.find((r) => r.cle === cle)?.defaut;
      return { texte: `${v('variable')} = ${Number(v('de')) + (tour - 1) * Number(v('pas'))}` };
    }
    return { texte: e.noeuds.get(n.id) === 'ok' ? `${tour} tours` : `tour ${tour}` };
  }
  const essai = e.essais.get(n.id);
  const essais = Number(n.data.valeurs.essais ?? 1);
  if (essai && essais > 1) return { texte: `essai ${essai}/${essais}`, relance: essai > 1 };
  return undefined;
}

/** Le panneau d'un nœud, façon n8n : ses réglages et ses paramètres, qui agissent ; ce qu'il lui faut ; ce qui en sort. */
function Panneau({ noeud, modifier, fermer }: { noeud: NoeudMission; modifier(d: Partial<DonneesNoeud>): void; fermer(): void }) {
  const t: TypeNoeud = noeud.data.type;
  const f = FAMILLE[t.famille];
  const valeurs = noeud.data.valeurs;
  const regler = (cle: string, v: string) => modifier({ valeurs: { ...valeurs, [cle]: v } });
  return (
    <aside className="em-panneau" aria-label={`Réglages de ${t.nom}`} onContextMenu={(e) => e.stopPropagation()}>
      <header className="em-panneau-tete" style={{ ['--famille' as string]: f.couleur }}>
        <IconeNoeud nom={t.icone} couleur={f.couleur} taille={18} />
        <div><p>{f.nom}</p><h3>{t.nom}</h3></div>
        <button onClick={fermer} aria-label="Fermer">×</button>
      </header>
      <div className="em-panneau-colonnes">
        <section>
          <p className="em-panneau-titre">RÉGLAGES</p>
          {t.reglages.length === 0 && <p className="em-discret">Aucun réglage.</p>}
          {t.reglages.map((r) => (
            <label key={r.cle} className="em-reglage">
              <span>{r.libelle}{r.unite ? ` (${r.unite})` : ''}</span>
              {r.options ? (
                <select value={String(valeurs[r.cle] ?? r.defaut ?? '')} onChange={(e) => regler(r.cle, e.target.value)}>
                  {r.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input value={String(valeurs[r.cle] ?? r.defaut ?? '')} onChange={(e) => regler(r.cle, e.target.value)} />
              )}
              {r.aide && <small>{r.aide}</small>}
            </label>
          ))}
          {t.sorties.includes('echec') && <>
            <p className="em-panneau-titre em-panneau-statut">PARAMÈTRES</p>
            <label className="em-reglage">
              <span>Essais</span>
              <input type="number" min={1} max={5} value={Number(valeurs.essais ?? 1)} onChange={(e) => regler('essais', e.target.value)} />
              <small>Rejouer le geste s’il rate, avant de suivre « si ça rate ».</small>
            </label>
            <label className="em-reglage">
              <span>Si ça rate</span>
              <select value={noeud.data.echec ? 'sortie' : 'arreter'} onChange={(e) => modifier({ echec: e.target.value === 'sortie' })}>
                <option value="arreter">arrêter la mission</option>
                <option value="sortie">suivre la sortie « échec »</option>
              </select>
            </label>
          </>}
        </section>
        <section>
          <p className="em-panneau-titre">IL LUI FAUT</p>
          {t.prerequis?.length ? <ul>{t.prerequis.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="em-discret">Rien de particulier.</p>}
          <p className="em-panneau-titre em-panneau-statut">CE QUI SORT</p>
          <ul>{sortiesVisibles(t, noeud.data.echec).map((s) => <li key={s}><b style={{ color: s === 'echec' ? '#ffb02e' : '#e9eef7' }}>{SORTIES[s].libelle || 'la suite'}</b></li>)}</ul>
          {t.produit?.length ? <><p className="em-panneau-titre em-panneau-statut">FOURNIT À LA SUITE</p><ul>{t.produit.map((p) => <li key={p}>{p}</li>)}</ul></> : null}
          {t.issues?.length ? <><p className="em-panneau-titre em-panneau-statut">ÉCHECS POSSIBLES</p><ul className="em-issues">{t.issues.map((p) => <li key={p}>{p}</li>)}</ul></> : null}
          <p className="em-panneau-titre em-panneau-statut">{STATUTS[t.statut].libelle.toUpperCase()}</p>
          <p className="em-discret">{t.aujourdhui ?? STATUTS[t.statut].aide}</p>
        </section>
      </div>
      <p className="em-panneau-aide">{t.aide}</p>
    </aside>
  );
}

/** Les nœuds par famille, filtrés par une recherche : la palette et le menu du « + » les montrent pareil. */
function Liste({ cherche, filtre, rendu }: { cherche: string; filtre?: (t: TypeNoeud) => boolean; rendu(t: TypeNoeud): ReactNode }) {
  const visibles = CATALOGUE.filter((t) => (!filtre || filtre(t)) && `${t.nom} ${t.phrase}`.toLowerCase().includes(cherche.toLowerCase()));
  return (
    <>
      {FAMILLES.map((f) => {
        const ts = visibles.filter((t) => t.famille === f.cle);
        if (!ts.length) return null;
        return (
          <div key={f.cle} className="em-palette-famille">
            <p style={{ color: f.couleur }}>{f.nom.toUpperCase()}</p>
            {ts.map(rendu)}
          </div>
        );
      })}
    </>
  );
}

function Item({ t }: { t: TypeNoeud }) {
  const f = FAMILLE[t.famille];
  return (
    <>
      <IconeNoeud nom={t.icone} couleur={f.couleur} taille={14} />
      <span>{t.nom}</span>
      {t.bouge && <i title="Fait bouger le robot" />}
    </>
  );
}

/** La palette, à droite : les nœuds rangés par famille, qu'on glisse sur le canevas. */
function Palette() {
  const [cherche, setCherche] = useState('');
  const glisser = (e: DragEvent, cle: string) => {
    e.dataTransfer.setData(GLISSE, cle);
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <aside className="em-palette" aria-label="Nœuds à glisser sur le canevas">
      <input className="em-recherche" placeholder="Chercher…" value={cherche} onChange={(e) => setCherche(e.target.value)} />
      <Liste cherche={cherche} rendu={(t) => (
        <div key={t.cle} className="em-palette-item" title={t.aide} draggable onDragStart={(e) => glisser(e, t.cle)}
          style={{ ['--famille' as string]: FAMILLE[t.famille].couleur }}><Item t={t} /></div>
      )} />
    </aside>
  );
}

/** Où le menu du « + » s'ouvre, et ce qu'il fera du nœud choisi : l'ajouter au bout d'une sortie, ou remplir une case vide. */
interface Choix { x: number; y: number; depuis?: { id: string; sortie: Sortie }; remplace?: string }

/** Le menu du « + » : chercher une étape et la poser, comme le panneau de nœuds de n8n. */
function Choisir({ choix, choisir }: { choix: Choix; choisir(t: TypeNoeud): void }) {
  const [cherche, setCherche] = useState('');
  return (
    <div className="em-choisir" style={{ left: choix.x, top: choix.y }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choisir l’étape">
      <input className="em-recherche" placeholder="Quelle étape ?" value={cherche} onChange={(e) => setCherche(e.target.value)} autoFocus />
      <div className="em-choisir-liste">
        <Liste cherche={cherche} filtre={(t) => t.entree} rendu={(t) => (
          <button key={t.cle} className="em-palette-item" title={t.aide} onClick={() => choisir(t)}
            style={{ ['--famille' as string]: FAMILLE[t.famille].couleur }}><Item t={t} /></button>
        )} />
      </div>
    </div>
  );
}

interface Menu { x: number; y: number; id: string }

/** Le menu d'un nœud, au clic droit : ses réglages d'abord, puis ce qu'on fait d'un nœud dans n8n. */
function MenuNoeud({ menu, noeud, actions }: { menu: Menu; noeud: NoeudMission; actions: Record<'reglages' | 'jouer' | 'dupliquer' | 'basculer' | 'supprimer', () => void> }) {
  const f = FAMILLE[noeud.data.type.famille];
  const item = (cle: keyof typeof actions, icone: string, texte: string, classe = '') => (
    <button role="menuitem" className={classe} onClick={actions[cle]}><span aria-hidden="true">{icone}</span>{texte}</button>
  );
  return (
    <div className="em-menu" style={{ left: menu.x, top: menu.y, ['--famille' as string]: f.couleur }} role="menu"
      onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <p><IconeNoeud nom={noeud.data.type.icone} couleur={f.couleur} taille={12} />{noeud.data.type.nom}</p>
      {item('reglages', '⚙', 'Réglages', 'em-menu-principal')}
      {item('jouer', '▶', 'Jouer cette étape')}
      {item('dupliquer', '⧉', 'Dupliquer')}
      {item('basculer', noeud.data.desactive ? '◉' : '◌', noeud.data.desactive ? 'Réactiver' : 'Désactiver')}
      <hr />
      {item('supprimer', '✕', 'Supprimer', 'em-menu-suppr')}
    </div>
  );
}

/**
 * Un nœud neuf à `position` ; une boucle vient avec sa case à remplir, branchée sur « faire » et revenant dans son
 * entrée — le « Replace Me » de n8n.
 */
function nouveau(t: TypeNoeud, position: XYPosition): { nodes: NoeudMission[]; edges: LienMission[] } {
  const id = nouvelId('n');
  const n: NoeudMission = { id, type: 'carte', position, data: { type: t, valeurs: {} } };
  if (!t.sorties.includes('faire')) return { nodes: [n], edges: [] };
  const vide: NoeudMission = { id: nouvelId('v'), type: 'vide', position: { x: position.x + COLONNE, y: position.y + 20 }, data: { type: t, valeurs: {} } };
  return { nodes: [n, vide], edges: [lien(nouvelId('e'), id, 'faire', vide.id), lien(nouvelId('e'), vide.id, 'suite', id)] };
}

function Canevas() {
  const flot = useReactFlow();
  const depart = useMemo(() => exemple(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<NoeudMission>(depart.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LienMission>(depart.edges);
  const [reglages, setReglages] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [pas, setPas] = useState(-1);
  const [arrete, setArrete] = useState(false);
  const minuterie = useRef<number | undefined>(undefined);
  const boite = useRef<HTMLDivElement>(null);
  const canevas = useRef<HTMLDivElement>(null);
  const parcours = useRef<string[]>([]);
  const flux = useFlux(parcours);

  useEffect(() => () => clearInterval(minuterie.current), []);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(null);
      setReglages(null);
      setChoix(null);
    };
    addEventListener('keydown', echap);
    return () => removeEventListener('keydown', echap);
  }, []);

  /** Un point de l'écran, ramené dans la boîte du prototype et gardé à l'intérieur. */
  const dansLaBoite = (p: Point, w: number, h: number) => {
    const r = boite.current!.getBoundingClientRect();
    return { x: Math.max(8, Math.min(p.x - r.left, r.width - w)), y: Math.max(8, Math.min(p.y - r.top, r.height - h)) };
  };

  const actionsCanevas = useMemo<ActionsCanevas>(() => ({
    ajouter: (id, sortie, ou) => setChoix({ ...dansLaBoite(ou, 250, 340), depuis: { id, sortie: sortie as Sortie } }),
    remplacer: (id, ou) => setChoix({ ...dansLaBoite(ou, 250, 340), remplace: id }),
  }), []);

  /** Pose le nœud choisi au bout de la sortie, ou à la place de la case vide. */
  function choisir(t: TypeNoeud) {
    const c = choix;
    setChoix(null);
    if (!c) return;
    if (c.remplace) {
      const premiere = sortiesVisibles(t)[0] ?? 'suite';
      setNodes((ns) => ns.map((n) => (n.id === c.remplace ? { ...n, type: 'carte', data: { type: t, valeurs: {} } } : n)));
      setEdges((ls) => ls.map((l) => (l.source === c.remplace ? lien(l.id, l.source, premiere, l.target) : l)));
      return;
    }
    const source = nodes.find((n) => n.id === c.depuis?.id);
    if (!source || !c.depuis) return;
    const sorties = sortiesVisibles(source.data.type, source.data.echec);
    const decalage = (sorties.indexOf(c.depuis.sortie) - (sorties.length - 1) / 2) * RANGEE;
    const ajout = nouveau(t, { x: source.position.x + COLONNE, y: source.position.y + decalage });
    setNodes((ns) => [...ns, ...ajout.nodes]);
    setEdges((ls) => [...ls, lien(nouvelId('e'), source.id, c.depuis!.sortie, ajout.nodes[0].id), ...ajout.edges]);
  }

  /** Pose sur le canevas l'état de la mission après `k` pas ; un arrêt d'urgence passe en rouge ce qui tournait. */
  function poser(k: number, urgence = false) {
    const e = rejouer(k);
    const lienActif = [...e.liens].find(([, x]) => x === 'actif')?.[0];
    parcours.current = k < 0 || urgence ? [] : e.parcours;
    setNodes((ns) => ns.map((n) => {
      const etat = e.noeuds.get(n.id);
      return {
        ...n, data: {
          ...n.data, direct: direct(n, e), prise: e.prises.get(n.id),
          veille: etat === 'cours' && k >= 0 && DEROULE[k].noeud !== n.id,
          etat: k < 0 ? undefined : urgence && etat === 'cours' ? 'danger' : etat ?? (k >= DEROULE.length - 1 ? e.anciens.get(n.id) ?? 'saute' : 'attente'),
        },
      };
    }));
    setEdges((ls) => ls.map((l) => ({
      ...l, data: {
        ...l.data!, etat: k < 0 ? 'aucun' : e.liens.get(l.id) ?? 'aucun',
        ton: urgence && l.id === lienActif ? 'danger' : tonDe(l.data!.sortie),
      },
    })));
    if (k >= 0 && !urgence) suivre(DEROULE[k].noeud);
  }

  /** La vue suit l'exécution : si l'étape en cours sort du cadre, on glisse jusqu'à elle, sans changer le zoom. */
  function suivre(id: string) {
    const n = flot.getInternalNode(id);
    const zone = canevas.current?.querySelector('.react-flow')?.getBoundingClientRect();
    if (!n || !zone) return;
    const { x, y, zoom } = flot.getViewport();
    const p = n.internals.positionAbsolute;
    const w = (n.measured.width ?? 76) + 60;
    const h = (n.measured.height ?? 76) + 50;
    const marge = 40;
    const gauche = p.x * zoom + x;
    const haut = p.y * zoom + y;
    const dedans = gauche > marge && haut > marge && gauche + w * zoom < zone.width - marge && haut + h * zoom < zone.height - marge;
    if (!dedans) flot.setCenter(p.x + w / 2, p.y + h / 2, { zoom, duration: 700 });
  }

  function simuler() {
    clearInterval(minuterie.current);
    setArrete(false);
    void flot.fitView({ ...VUE_DE_DEPART, duration: 500 });
    let k = -1;
    minuterie.current = window.setInterval(() => {
      k += 1;
      setPas(k);
      poser(k);
      if (k >= DEROULE.length - 1) clearInterval(minuterie.current);
    }, PAS_MS);
  }
  function urgence() {
    clearInterval(minuterie.current);
    setArrete(true);
    poser(pas, true);
  }
  function remettre() {
    clearInterval(minuterie.current);
    setPas(-1);
    setArrete(false);
    poser(-1);
    void flot.fitView({ ...VUE_DE_DEPART, duration: 500 });
  }

  const changer = (id: string, f: (n: NoeudMission) => NoeudMission) => setNodes((ns) => ns.map((n) => (n.id === id ? f(n) : n)));
  /** Un réglage changé dans le panneau agit tout de suite ; fermer la sortie « échec » retire ses liens. */
  function modifier(id: string, d: Partial<DonneesNoeud>) {
    changer(id, (n) => ({ ...n, data: { ...n.data, ...d } }));
    if (d.echec === false) setEdges((ls) => ls.filter((l) => !(l.source === id && l.sourceHandle === 'echec')));
  }
  const actions = (id: string) => {
    const fermer = (f: () => void) => () => { f(); setMenu(null); };
    return {
      reglages: fermer(() => setReglages(id)),
      jouer: fermer(() => {
        changer(id, (n) => ({ ...n, data: { ...n.data, etat: 'cours' } }));
        window.setTimeout(() => changer(id, (n) => ({ ...n, data: { ...n.data, etat: 'ok' } })), PAS_MS * 2);
      }),
      dupliquer: fermer(() => {
        const n = nodes.find((x) => x.id === id);
        if (!n) return;
        setNodes((ns) => [...ns, { ...n, id: nouvelId('n'), selected: false, position: { x: n.position.x + 30, y: n.position.y + 110 }, data: { ...n.data, etat: undefined } }]);
      }),
      basculer: fermer(() => changer(id, (n) => ({ ...n, data: { ...n.data, desactive: !n.data.desactive } }))),
      supprimer: fermer(() => {
        setNodes((ns) => ns.filter((n) => n.id !== id));
        setEdges((ls) => ls.filter((l) => l.source !== id && l.target !== id));
        if (reglages === id) setReglages(null);
      }),
    };
  };

  function ouvrirMenu(e: MouseEvent, n: NoeudMission) {
    e.preventDefault();
    if (n.type === 'vide') return;
    setChoix(null);
    setMenu({ ...dansLaBoite({ x: e.clientX, y: e.clientY }, 200, 230), id: n.id });
  }

  function relier(c: Connection) {
    const sortie = (c.sourceHandle && c.sourceHandle in SORTIES ? c.sourceHandle : 'suite') as Sortie;
    setEdges((ls) => addEdge(lien(nouvelId('e'), c.source, sortie, c.target), ls));
  }

  function deposer(e: DragEvent) {
    e.preventDefault();
    const t = CATALOGUE.find((x) => x.cle === e.dataTransfer.getData(GLISSE));
    if (!t) return;
    const ajout = nouveau(t, flot.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    setNodes((ns) => [...ns, ...ajout.nodes]);
    setEdges((ls) => [...ls, ...ajout.edges]);
  }

  const noeudMenu = menu ? nodes.find((n) => n.id === menu.id) : undefined;
  const noeudReglages = reglages ? nodes.find((n) => n.id === reglages && n.type === 'carte') : undefined;
  const enCours = pas >= 0 && pas < DEROULE.length - 1 && !arrete;
  const etiquette = arrete ? 'arrêt d’urgence' : pas >= DEROULE.length - 1 ? 'terminée' : pas >= 0 ? `pas ${pas + 1} / ${DEROULE.length}` : 'prête';
  return (
    <Actions.Provider value={actionsCanevas}><Flux.Provider value={flux}>
      <div className="em-prototype" ref={boite} onClick={() => { setMenu(null); setChoix(null); }}>
        <div className="em-canevas" ref={canevas} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={deposer}>
          <div className="em-barre-outils">
            <span className="em-titre-mission">Vider la table dans le bac</span>
            <span className="em-pill-ok">✓ Vérifiée</span>
            <span className="em-espace" />
            <span className={`em-chrono ${arrete ? 'em-chrono-urgence' : ''}`}>{etiquette}</span>
            <button onClick={remettre} title="Remettre à zéro" aria-label="Remettre à zéro">↺</button>
            {enCours
              ? <button className="em-urgence" onClick={urgence}>■ Arrêt</button>
              : <button className="em-lancer" onClick={simuler}>▶ Simuler</button>}
          </div>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={TYPES_NOEUDS} edgeTypes={TYPES_LIENS}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={relier}
            onNodeContextMenu={(e, n) => ouvrirMenu(e, n)} onNodeDoubleClick={(_, n) => setReglages(n.id)}
            onPaneClick={() => { setMenu(null); setChoix(null); }} onPaneContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
            zoomOnDoubleClick={false} fitView fitViewOptions={VUE_DE_DEPART} minZoom={0.2}
            proOptions={{ hideAttribution: true }} colorMode="dark" deleteKeyCode={['Backspace', 'Delete']}>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a3038" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right"
              nodeColor={(n) => (n.type === 'vide' ? '#3a4049' : FAMILLE[(n.data as NoeudMission['data']).type.famille].couleur)}
              maskColor="rgb(5 6 8 / 0.75)" style={{ background: '#0b0d10', width: 140, height: 84 }} />
          </ReactFlow>
          <p className="em-astuce" aria-hidden="true"><kbd>+</kbd> étape suivante · <kbd>clic droit</kbd> actions · <kbd>double-clic</kbd> réglages · <kbd>glisser</kbd> depuis la palette</p>
        </div>
        <Palette />
        {menu && noeudMenu && <MenuNoeud menu={menu} noeud={noeudMenu} actions={actions(menu.id)} />}
        {choix && <Choisir choix={choix} choisir={choisir} />}
        {noeudReglages && <Panneau noeud={noeudReglages} modifier={(d) => modifier(noeudReglages.id, d)} fermer={() => setReglages(null)} />}
      </div>
    </Flux.Provider></Actions.Provider>
  );
}

/** Le prototype interactif de l'éditeur : canevas, palette à droite, menu et réglages, simulation d'une exécution. */
export function Prototype() {
  return <ReactFlowProvider><Canevas /></ReactFlowProvider>;
}
