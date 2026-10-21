import {
  addEdge, Background, BackgroundVariant, BaseEdge, Controls, getSmoothStepPath, MarkerType, MiniMap, ReactFlow,
  ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { FAMILLE, FAMILLES, SORTIES, STATUTS, type EtatLien, type EtatNoeud, type Sortie, type Ton } from './charte';
import { CATALOGUE, type TypeNoeud } from './catalogue';
import { IconeNoeud, NoeudCadre, NoeudCarte, type DonneesNoeud, type NoeudMission } from './Noeud';
import { OndeChemin } from './Onde';
import { placerSections, TETE } from './structure';

/** Un pas de la simulation dure un peu plus d'une période de l'onde (1 Hz) : on la voit passer au moins une fois. */
const PAS_MS = 1100;
const GLISSE = 'application/x-noeud-mission';


type DonneesLien = { sortie: Sortie; etat?: EtatLien; ton?: Ton };
type LienMission = Edge<DonneesLien, 'pulse'>;

/** La couleur d'un lien parcouru : celle de l'issue de la sortie ; entrer dans une section n'est pas une issue. */
function tonDe(s: Sortie): Ton {
  if (s === 'echec' || s === 'faux' || s === 'autre') return 'echec';
  return ['corps', 'alors', 'sinon', 'cas1', 'cas2'].includes(s) ? 'neutre' : 'ok';
}

/**
 * Un lien de mission. Au repos, le trait de sa sortie ; parcouru ou actif, l'onde de `OndeChemin` par-dessus.
 */
function LienPulse({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }: EdgeProps<LienMission>) {
  const [chemin] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10 });
  const etat = data?.etat ?? 'aucun';
  return (
    <>
      <BaseEdge id={id} path={chemin} markerEnd={markerEnd} style={{ ...style, opacity: etat === 'aucun' ? 0.6 : 0.95 }} />
      <OndeChemin d={chemin} etat={etat} ton={data?.ton ?? 'neutre'} />
    </>
  );
}

const TYPES_NOEUDS = { carte: NoeudCarte, cadre: NoeudCadre };
/** La vue de départ cadre le début de la mission à une taille lisible ; la suite vient en suivant l'exécution. */
const VUE_DE_DEPART = { nodes: [{ id: 'depart' }, { id: 'aller' }, { id: 'essai' }], padding: 0.06, maxZoom: 1 };
const TYPES_LIENS = { pulse: LienPulse };
const T = (cle: string) => CATALOGUE.find((t) => t.cle === cle)!;
const nouvelId = (prefixe: string) => `${prefixe}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Un lien selon sa sortie : plein pour le chemin normal, pointillé ambre pour l'échec ; aucun texte. */
function lien(id: string, source: string, sortie: Sortie, target: string, cible?: string): LienMission {
  const s = SORTIES[sortie];
  return {
    id, source, target, sourceHandle: sortie, targetHandle: cible, type: 'pulse', data: { sortie },
    style: { stroke: s.couleur, strokeWidth: 1.6, strokeDasharray: s.pointille ? '6 5' : undefined },
    markerEnd: { type: MarkerType.ArrowClosed, color: s.couleur, width: 14, height: 14 },
  };
}

/** Les cotes de la mission d'exemple : une carte se centre sur le départ ▸ de sa section, une structure y aligne sa tête. */
const CARTE = 23;
const W_ESSAI = 520;
const W_SI = 300;

/**
 * La mission d'exemple, écrite avec le catalogue : « Vider la table dans le bac ».
 *
 *   POUR CHAQUE pièce SUR la table
 *     ESSAYER 2 FOIS : prendre la pièce
 *     SI ÇA RATE ENCORE : appeler l'opérateur, PASSER AU SUIVANT
 *     FIN ESSAYER
 *     poser dans le bac B, déposées +1
 *     SI bac plein ALORS appeler l'opérateur SINON rien FIN SI
 *   FIN POUR
 *   rentrer les bras, aller à la base
 */
function exemple(): { nodes: NoeudMission[]; edges: LienMission[] } {
  const dans = (parentId?: string) => (parentId ? { parentId, extent: 'parent' as const } : {});
  const carte = (id: string, cle: string, x: number, y: number, valeurs = {}, parentId?: string): NoeudMission => ({
    id, type: 'carte', position: { x, y }, data: { type: T(cle), valeurs }, ...dans(parentId),
  });
  const cadre = (id: string, cle: string, x: number, y: number, w: number, donnees: Partial<DonneesNoeud>, parentId?: string): NoeudMission => ({
    id, type: 'cadre', position: { x, y }, style: { width: w, height: placerSections(T(cle), donnees.hauteurs).hauteur },
    data: { type: T(cle), valeurs: {}, ...donnees }, ...dans(parentId),
  });
  const essai = placerSections(T('essayer'), [76, 76]);
  const si = placerSections(T('si'), [76, 52]);
  const boucle = placerSections(T('pour_chaque'), [essai.hauteur + 44]);
  const ligne = boucle.sections[0].depart;
  const xPoser = 40 + W_ESSAI + 44;
  const xSi = xPoser + 470;
  const wBoucle = xSi + W_SI + 30;
  const xApres = 420 + wBoucle + 50;
  const nodes: NoeudMission[] = [
    carte('depart', 'au_lancement', 0, 150),
    carte('aller', 'deplacer', 180, 150, { poste: 'table' }),
    cadre('boucle', 'pour_chaque', 420, 150 + CARTE - TETE / 2, wBoucle, { valeurs: { objet: 'pièce', zone: 'la table' }, hauteurs: [essai.hauteur + 44] }),
    cadre('essai', 'essayer', 40, ligne - TETE / 2, W_ESSAI, { valeurs: { fois: 2 }, hauteurs: [76, 76] }, 'boucle'),
    carte('prendre', 'prise_objet', 44, essai.sections[0].depart - CARTE, { primitive: 'pièce' }, 'essai'),
    carte('appel', 'demander', 44, essai.sections[1].depart - CARTE, { message: 'Retirez la pièce' }, 'essai'),
    carte('passer', 'passer', 286, essai.sections[1].depart - CARTE, {}, 'essai'),
    carte('poser', 'depose_objet', xPoser, ligne - CARTE, { primitive: 'bac B' }, 'boucle'),
    carte('compter', 'compteur', xPoser + 240, ligne - CARTE, { variable: 'déposées' }, 'boucle'),
    cadre('si', 'si', xSi, ligne - TETE / 2, W_SI, { valeurs: { condition: 'bac plein' }, hauteurs: [76, 52], vides: ['sinon'] }, 'boucle'),
    carte('appel_bac', 'demander', 44, si.sections[0].depart - CARTE, { message: 'Videz le bac' }, 'si'),
    carte('rentrer', 'rentrer', xApres, 150),
    carte('base', 'deplacer', xApres + 240, 150, { poste: 'base' }),
    carte('fin', 'terminer', xApres + 470, 150, { verdict: 'réussie' }),
  ];
  const edges: LienMission[] = [
    lien('e1', 'depart', 'suite', 'aller'),
    lien('e2', 'aller', 'ok', 'boucle'),
    lien('e3', 'boucle', 'corps', 'essai'),
    lien('e4', 'essai', 'corps', 'prendre'),
    lien('e5', 'essai', 'echec', 'appel'),
    lien('e6', 'appel', 'ok', 'passer'),
    lien('e7', 'essai', 'suite', 'poser'),
    lien('e8', 'poser', 'ok', 'compter'),
    lien('e9', 'compter', 'suite', 'si'),
    lien('e10', 'si', 'alors', 'appel_bac'),
    lien('e11', 'boucle', 'suite', 'rentrer'),
    lien('e12', 'rentrer', 'ok', 'base'),
    lien('e13', 'base', 'ok', 'fin'),
  ];
  return { nodes, edges };
}

/**
 * Un pas de la simulation : un nœud change d'état ; un lien s'allume vers lui ; une structure change de tour, d'essai
 * ou de section ; une boucle repart (son rail s'allume).
 */
interface Pas { noeud: string; etat: EtatNoeud; lien?: string; tour?: number; essai?: number; branche?: string; reprise?: boolean; remettre?: string[] }

const TOUR_DE_BOUCLE = ['essai', 'prendre', 'appel', 'passer', 'poser', 'compter', 'si', 'appel_bac', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10'];

/** Deux pièces : la première passe ; la seconde rate ses deux essais, l'opérateur est appelé, on passe à la suivante. */
const DEROULE: Pas[] = [
  { noeud: 'depart', etat: 'ok' },
  { noeud: 'aller', etat: 'cours', lien: 'e1' }, { noeud: 'aller', etat: 'ok' },
  { noeud: 'boucle', etat: 'cours', lien: 'e2', tour: 1 },
  { noeud: 'essai', etat: 'cours', lien: 'e3', essai: 1 },
  { noeud: 'prendre', etat: 'cours', lien: 'e4' }, { noeud: 'prendre', etat: 'ok' },
  { noeud: 'essai', etat: 'ok' },
  { noeud: 'poser', etat: 'cours', lien: 'e7' }, { noeud: 'poser', etat: 'ok' },
  { noeud: 'compter', etat: 'cours', lien: 'e8' }, { noeud: 'compter', etat: 'ok' },
  { noeud: 'si', etat: 'cours', lien: 'e9' }, { noeud: 'si', etat: 'ok', branche: 'sinon' },
  { noeud: 'boucle', etat: 'cours', tour: 2, reprise: true, remettre: TOUR_DE_BOUCLE },
  { noeud: 'essai', etat: 'cours', lien: 'e3', essai: 1 },
  { noeud: 'prendre', etat: 'cours', lien: 'e4' }, { noeud: 'prendre', etat: 'echec' },
  { noeud: 'essai', etat: 'cours', essai: 2, remettre: ['prendre', 'e4'] },
  { noeud: 'prendre', etat: 'cours', lien: 'e4' }, { noeud: 'prendre', etat: 'echec' },
  { noeud: 'essai', etat: 'echec', branche: 'echec' },
  { noeud: 'appel', etat: 'cours', lien: 'e5' }, { noeud: 'appel', etat: 'ok' },
  { noeud: 'passer', etat: 'cours', lien: 'e6' }, { noeud: 'passer', etat: 'ok' },
  { noeud: 'boucle', etat: 'cours', reprise: true },
  { noeud: 'boucle', etat: 'ok' },
  { noeud: 'rentrer', etat: 'cours', lien: 'e11' }, { noeud: 'rentrer', etat: 'ok' },
  { noeud: 'base', etat: 'cours', lien: 'e12' }, { noeud: 'base', etat: 'ok' },
  { noeud: 'fin', etat: 'cours', lien: 'e13' }, { noeud: 'fin', etat: 'ok' },
];

interface Instantane {
  noeuds: Map<string, EtatNoeud>;
  tours: Map<string, number>;
  essais: Map<string, number>;
  branches: Map<string, string>;
  liens: Map<string, EtatLien>;
}

/** L'état de la mission après `k` pas : chaque nœud et chaque lien à leur dernier état. */
function rejouer(k: number): Instantane {
  const e: Instantane = { noeuds: new Map(), tours: new Map(), essais: new Map(), branches: new Map(), liens: new Map() };
  const eteindre = () => {
    for (const [id, x] of e.liens) if (x === 'actif') e.liens.set(id, 'parcouru');
  };
  for (const p of DEROULE.slice(0, k + 1)) {
    for (const id of p.remettre ?? []) {
      for (const m of [e.noeuds, e.liens, e.essais, e.branches]) m.delete(id);
    }
    if (p.lien || p.reprise) eteindre();
    if (p.lien) e.liens.set(p.lien, 'actif');
    e.noeuds.set(p.noeud, p.etat);
    if (p.tour) e.tours.set(p.noeud, p.tour);
    if (p.essai) e.essais.set(p.noeud, p.essai);
    if (p.branche) e.branches.set(p.noeud, p.branche);
  }
  if (k >= DEROULE.length - 1) eteindre();
  return e;
}

/** Le panneau d'un nœud, façon n8n : ce qu'il lui faut, ses réglages, ce qui en sort. */
function Panneau({ noeud, fermer }: { noeud: NoeudMission; fermer(): void }) {
  const t: TypeNoeud = noeud.data.type;
  const f = FAMILLE[t.famille];
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
                <select defaultValue={String(noeud.data.valeurs[r.cle] ?? r.defaut ?? '')}>{r.options.map((o) => <option key={o}>{o}</option>)}</select>
              ) : (
                <input defaultValue={String(noeud.data.valeurs[r.cle] ?? r.defaut ?? '')} />
              )}
              {r.aide && <small>{r.aide}</small>}
            </label>
          ))}
        </section>
        <section>
          <p className="em-panneau-titre">IL LUI FAUT</p>
          {t.prerequis?.length ? <ul>{t.prerequis.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="em-discret">Rien de particulier.</p>}
          <p className="em-panneau-titre em-panneau-statut">CE QUI SORT</p>
          <ul>{t.sorties.filter((s) => SORTIES[s].libelle).map((s) => <li key={s}><b style={{ color: SORTIES[s].couleur }}>{SORTIES[s].libelle}</b></li>)}</ul>
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

/** La palette, à droite : les nœuds rangés par famille, qu'on glisse sur le canevas. */
function Palette() {
  const [cherche, setCherche] = useState('');
  const visibles = CATALOGUE.filter((t) => `${t.nom} ${t.phrase}`.toLowerCase().includes(cherche.toLowerCase()));
  const glisser = (e: DragEvent, cle: string) => {
    e.dataTransfer.setData(GLISSE, cle);
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <aside className="em-palette" aria-label="Nœuds à glisser sur le canevas">
      <input className="em-recherche" placeholder="Chercher…" value={cherche} onChange={(e) => setCherche(e.target.value)} />
      {FAMILLES.map((f) => {
        const ts = visibles.filter((t) => t.famille === f.cle);
        if (!ts.length) return null;
        return (
          <div key={f.cle} className="em-palette-famille">
            <p style={{ color: f.couleur }}>{f.nom.toUpperCase()}</p>
            {ts.map((t) => (
              <div key={t.cle} className="em-palette-item" title={t.aide} draggable onDragStart={(e) => glisser(e, t.cle)}
                style={{ ['--famille' as string]: f.couleur }}>
                <IconeNoeud nom={t.icone} couleur={f.couleur} taille={14} />
                <span>{t.nom}</span>
                {t.bouge && <i title="Fait bouger le robot" />}
              </div>
            ))}
          </div>
        );
      })}
    </aside>
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

function Canevas() {
  const flot = useReactFlow();
  const depart = useMemo(() => exemple(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<NoeudMission>(depart.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LienMission>(depart.edges);
  const [reglages, setReglages] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [pas, setPas] = useState(-1);
  const [arrete, setArrete] = useState(false);
  const minuterie = useRef<number | undefined>(undefined);
  const boite = useRef<HTMLDivElement>(null);
  const canevas = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearInterval(minuterie.current), []);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(null);
      setReglages(null);
    };
    addEventListener('keydown', echap);
    return () => removeEventListener('keydown', echap);
  }, []);

  /** Pose sur le canevas l'état de la mission après `k` pas ; un arrêt d'urgence passe en rouge ce qui tournait. */
  function poser(k: number, urgence = false) {
    const e = rejouer(k);
    const lienActif = [...e.liens].find(([, x]) => x === 'actif')?.[0];
    setNodes((ns) => ns.map((n) => {
      const etat = e.noeuds.get(n.id);
      return {
        ...n, data: {
          ...n.data, tour: e.tours.get(n.id), essai: e.essais.get(n.id), branche: e.branches.get(n.id),
          reprise: k >= 0 && !urgence && DEROULE[k].noeud === n.id && DEROULE[k].reprise,
          etat: k < 0 ? undefined : urgence && etat === 'cours' ? 'danger' : etat ?? (k >= DEROULE.length - 1 ? 'saute' : 'attente'),
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
    const structure = n.type === 'cadre';
    const w = Math.min(n.measured.width ?? 160, structure ? 320 : Infinity);
    const h = structure ? TETE : n.measured.height ?? 46;
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
        setNodes((ns) => [...ns, { ...n, id: nouvelId('n'), selected: false, position: { x: n.position.x + 30, y: n.position.y + 64 }, data: { ...n.data, etat: undefined } }]);
      }),
      basculer: fermer(() => changer(id, (n) => ({ ...n, data: { ...n.data, desactive: !n.data.desactive } }))),
      supprimer: fermer(() => {
        const partis = new Set([id]);
        for (let encore = true; encore;) {
          encore = false;
          for (const n of nodes) if (n.parentId && partis.has(n.parentId) && !partis.has(n.id)) { partis.add(n.id); encore = true; }
        }
        setNodes((ns) => ns.filter((n) => !partis.has(n.id)));
        setEdges((ls) => ls.filter((l) => !partis.has(l.source) && !partis.has(l.target)));
        if (reglages && partis.has(reglages)) setReglages(null);
      }),
    };
  };

  function ouvrirMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    const r = boite.current!.getBoundingClientRect();
    setMenu({ x: Math.min(e.clientX - r.left, r.width - 200), y: Math.min(e.clientY - r.top, r.height - 230), id });
  }

  function relier(c: Connection) {
    const sortie = (c.sourceHandle && c.sourceHandle in SORTIES ? c.sourceHandle : 'suite') as Sortie;
    setEdges((ls) => addEdge(lien(nouvelId('e'), c.source, sortie, c.target, c.targetHandle ?? undefined), ls));
  }

  function deposer(e: DragEvent) {
    e.preventDefault();
    const t = CATALOGUE.find((x) => x.cle === e.dataTransfer.getData(GLISSE));
    if (!t) return;
    const position = flot.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setNodes((ns) => [...ns, {
      id: nouvelId('n'), type: t.structure ? 'cadre' : 'carte', position, data: { type: t, valeurs: {} },
      ...(t.structure ? { style: { width: 360, height: placerSections(t).hauteur } } : {}),
    }]);
  }

  const noeudMenu = menu ? nodes.find((n) => n.id === menu.id) : undefined;
  const noeudReglages = reglages ? nodes.find((n) => n.id === reglages) : undefined;
  const enCours = pas >= 0 && pas < DEROULE.length - 1 && !arrete;
  const etiquette = arrete ? 'arrêt d’urgence' : pas >= DEROULE.length - 1 ? 'terminée' : pas >= 0 ? `pas ${pas + 1} / ${DEROULE.length}` : 'prête';
  return (
    <div className="em-prototype" ref={boite} onClick={() => setMenu(null)}>
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
          onNodeContextMenu={(e, n) => ouvrirMenu(e, n.id)} onNodeDoubleClick={(_, n) => setReglages(n.id)}
          onPaneClick={() => setMenu(null)} onPaneContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
          zoomOnDoubleClick={false} fitView fitViewOptions={VUE_DE_DEPART} minZoom={0.2}
          proOptions={{ hideAttribution: true }} colorMode="dark" deleteKeyCode={['Backspace', 'Delete']}>
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a3038" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable position="bottom-right" nodeColor={(n) => FAMILLE[(n.data as NoeudMission['data']).type.famille].couleur}
            maskColor="rgb(5 6 8 / 0.75)" style={{ background: '#0b0d10', width: 140, height: 84 }} />
        </ReactFlow>
        <p className="em-astuce" aria-hidden="true"><kbd>clic droit</kbd> actions · <kbd>double-clic</kbd> réglages · <kbd>glisser</kbd> depuis la palette</p>
      </div>
      <Palette />
      {menu && noeudMenu && <MenuNoeud menu={menu} noeud={noeudMenu} actions={actions(menu.id)} />}
      {noeudReglages && <Panneau noeud={noeudReglages} fermer={() => setReglages(null)} />}
    </div>
  );
}

/** Le prototype interactif de l'éditeur : canevas, palette à droite, menu et réglages, simulation d'une exécution. */
export function Prototype() {
  return <ReactFlowProvider><Canevas /></ReactFlowProvider>;
}
