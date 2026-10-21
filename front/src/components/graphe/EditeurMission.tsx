import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Fragment, useContext, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { ANCRAGES, TYPES_PRIMITIVE, depuis } from '../../api/libelles';
import type { Execution, LienMission, NoeudMission, Primitive, TypePrimitive } from '../../api/types';
import { Actions, type ActionsCanevas, type Point } from '../missions/actions';
import { ApparenceContexte, teinte } from '../missions/apparence';
import { FAMILLE, type EtatLien, type Sortie } from '../missions/charte';
import { CATALOGUE, type TypeNoeud } from '../missions/catalogue';
import { LienPulse } from '../missions/Lien';
import { lien, tonDe, type LienCanevas } from '../missions/liens';
import { IconeNoeud, NoeudCarte, type NoeudMission as NoeudCanevas } from '../missions/Noeud';
import { atteignables, etatsExecution, poignee, typePrimitive, versCanevas, versMission, type Trace } from './correspondance';

const TYPES_NOEUDS = { carte: NoeudCarte };
const TYPES_LIENS = { pulse: LienPulse };
const GLISSE = 'application/x-primitive';
const COLONNE = 200;
const RANGEE = 120;
/** Les nœuds de logique que le back ne sait pas encore jouer : la palette les montre, grisés. */
const A_VENIR = ['si', 'pour_chaque', 'tant_que', 'repeter', 'attendre', 'demander'];

const nouvelId = (prefixe: string) => `${prefixe}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

interface Props {
  noeuds: NoeudMission[];
  liens: LienMission[];
  primitives: Primitive[];
  modifiable: boolean;
  /** La mission en cours sur le robot, si c'est celle-ci : l'éditeur montre où elle en est. */
  execution: Execution | null;
  /** Un run passé rejoué sur le canevas (onglet Exécutions) : il prime sur l'exécution en direct. */
  trace?: Trace | null;
  onChange(noeuds: NoeudMission[], liens: LienMission[]): void;
}

/** Le dernier nœud de la chaîne « réussi » qui part du départ : là où un clic dans la palette ajoute la suite. */
function boutDeChaine(nodes: NoeudCanevas[], edges: { source: string; target: string; sourceHandle?: string | null }[]): NoeudCanevas {
  let courant = nodes.find((n) => n.id === 'depart') ?? nodes[0];
  const vus = new Set<string>();
  for (;;) {
    vus.add(courant.id);
    const suite = edges.find((e) => e.source === courant.id && (e.sourceHandle ?? 'ok') !== 'echec');
    const prochain = suite && nodes.find((n) => n.id === suite.target);
    if (!prochain || vus.has(prochain.id)) return courant;
    courant = prochain;
  }
}

/** La palette, à droite : les primitives enregistrées par type, puis la logique à venir. */
function Palette({ primitives, ajouter }: { primitives: Primitive[]; ajouter(p: Primitive): void }) {
  const { couleurs } = useContext(ApparenceContexte).apparence;
  const [cherche, setCherche] = useState('');
  const groupes = (Object.keys(TYPES_PRIMITIVE) as TypePrimitive[])
    .map((t) => ({ t, ps: primitives.filter((p) => p.type === t && p.nom.toLowerCase().includes(cherche.toLowerCase())) }))
    .filter((g) => g.ps.length);
  return (
    <aside className="em-palette" aria-label="Primitives à ajouter">
      <input className="em-recherche" placeholder="Chercher…" value={cherche} onChange={(e) => setCherche(e.target.value)} />
      {groupes.map(({ t, ps }) => {
        const type = typePrimitive(ps[0]);
        const couleur = teinte(type.famille, couleurs);
        return (
          <div key={t} className="em-palette-famille">
            <p style={{ color: couleur }}>{TYPES_PRIMITIVE[t].libelle.toUpperCase()}</p>
            {ps.map((p) => (
              <button key={p.id} className="em-palette-item" title={p.description} draggable onClick={() => ajouter(p)}
                onDragStart={(e) => { e.dataTransfer.setData(GLISSE, p.id); e.dataTransfer.effectAllowed = 'copy'; }}
                style={{ ['--famille' as string]: couleur }}>
                <IconeNoeud nom={type.icone} couleur={couleur} taille={14} /><span>{p.nom}</span>
              </button>
            ))}
          </div>
        );
      })}
      <div className="em-palette-famille em-palette-avenir">
        <p style={{ color: teinte('logique', couleurs) }}>LOGIQUE · BIENTÔT</p>
        {A_VENIR.map((cle) => {
          const t = CATALOGUE.find((x) => x.cle === cle)!;
          return (
            <div key={cle} className="em-palette-item" title="Le back ne sait pas encore la jouer : voir la proposition d’intégration.">
              <IconeNoeud nom={t.icone} couleur={teinte(t.famille, couleurs)} taille={14} /><span>{t.nom}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/** Le menu du « + » : choisir la primitive qui suit cette sortie. */
function Choisir({ x, y, primitives, choisir }: { x: number; y: number; primitives: Primitive[]; choisir(p: Primitive): void }) {
  const { couleurs } = useContext(ApparenceContexte).apparence;
  const [cherche, setCherche] = useState('');
  const visibles = primitives.filter((p) => p.nom.toLowerCase().includes(cherche.toLowerCase()));
  return (
    <div className="em-choisir" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choisir la primitive">
      <input className="em-recherche" placeholder="Quelle primitive ?" value={cherche} onChange={(e) => setCherche(e.target.value)} autoFocus />
      <div className="em-choisir-liste">
        {visibles.map((p) => {
          const t = typePrimitive(p);
          const couleur = teinte(t.famille, couleurs);
          return (
            <button key={p.id} className="em-palette-item" onClick={() => choisir(p)} style={{ ['--famille' as string]: couleur }}>
              <IconeNoeud nom={t.icone} couleur={couleur} taille={14} /><span>{p.nom}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Le panneau d'un nœud : une primitive (ce qu'elle est, son historique) ou un nœud du catalogue (ses réglages), et ce
 * que fait la mission s'il rate, quand il peut rater.
 */
function Panneau({ t, valeurs, primitive, echec, modifiable, changerEchec, fermer }: {
  t: TypeNoeud; valeurs: Record<string, string | number>; primitive: Primitive | undefined; echec: boolean; modifiable: boolean;
  changerEchec(v: boolean): void; fermer(): void;
}) {
  const couleur = teinte(t.famille, useContext(ApparenceContexte).apparence.couleurs);
  const ligne = (titre: string, valeur: string | null | undefined) => valeur ? <li><span>{titre}</span>{valeur}</li> : null;
  return (
    <aside className="em-panneau" aria-label={`Réglages de ${t.nom}`} onClick={(e) => e.stopPropagation()}>
      <header className="em-panneau-tete" style={{ ['--famille' as string]: couleur }}>
        <IconeNoeud nom={t.icone} couleur={couleur} taille={18} />
        <div><p>{primitive ? TYPES_PRIMITIVE[primitive.type].libelle : FAMILLE[t.famille].nom}</p><h3>{t.nom}</h3></div>
        <button onClick={fermer} aria-label="Fermer">×</button>
      </header>
      <div className="em-panneau-colonnes">
        <section>
          <p className="em-panneau-titre">{primitive ? 'LA PRIMITIVE' : 'LE NŒUD'}</p>
          <ul className="em-fiche">
            {ligne('Objet', primitive?.objet)}
            {ligne('Ancrage', primitive?.ancrage ? ANCRAGES[primitive.ancrage] : null)}
            {ligne('Poste', primitive?.poste)}
            {ligne('Vitesse', primitive ? `×${primitive.vitesse.toFixed(2)}` : null)}
            {!primitive && t.reglages.map((r) => (
              <Fragment key={r.cle}>{ligne(r.libelle, `${valeurs[r.cle] ?? r.defaut ?? '…'}${r.unite ? ` ${r.unite}` : ''}`)}</Fragment>
            ))}
          </ul>
          {t.sorties.includes('echec') && <>
            <p className="em-panneau-titre em-panneau-statut">SI ÇA RATE</p>
            <label className="em-reglage">
              <select value={echec ? 'sortie' : 'arreter'} disabled={!modifiable} onChange={(e) => changerEchec(e.target.value === 'sortie')}>
                <option value="arreter">arrêter la mission</option>
                <option value="sortie">suivre la sortie « échec »</option>
              </select>
            </label>
          </>}
        </section>
        {primitive && (
          <section>
            <p className="em-panneau-titre">HISTORIQUE</p>
            <ul className="em-fiche">
              {ligne('Réussite', primitive.tauxReussite != null ? `${Math.round(primitive.tauxReussite * 100)} %` : 'jamais jouée')}
              {ligne('Exécutions', String(primitive.executions))}
              {ligne('Créée par', `${primitive.creePar}, ${depuis(primitive.creeLe)}`)}
            </ul>
          </section>
        )}
      </div>
      <p className="em-panneau-aide">{t.aide}</p>
    </aside>
  );
}

interface Menu { x: number; y: number; id: string }
interface Choix { x: number; y: number; id: string; sortie: Sortie }

function Canevas({ noeuds, liens, primitives, modifiable, execution, trace, onChange }: Props) {
  const flot = useReactFlow();
  const { couleurs } = useContext(ApparenceContexte).apparence;
  const parId = useMemo(() => new Map(primitives.map((p) => [p.id, p])), [primitives]);
  const depart = useMemo(() => versCanevas(noeuds, liens, parId), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState<NoeudCanevas>(depart.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(depart.edges);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [reglages, setReglages] = useState<string | null>(null);
  const boite = useRef<HTMLDivElement>(null);

  // Échap ferme d'abord la fiche ou le menu ouvert, avant l'écran des missions (que l'overlay ferme sur Échap).
  const ouvert = Boolean(menu || choix || reglages);
  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setMenu(null);
      setChoix(null);
      setReglages(null);
    };
    window.addEventListener('keydown', echap, true);
    return () => window.removeEventListener('keydown', echap, true);
  }, [ouvert]);

  // Ce qu'on montre sans le stocker : le marquage « non relié », la lecture seule, et l'état d'une exécution.
  const relies = useMemo(() => atteignables(edges), [edges]);
  const etats = useMemo(() => trace ?? (execution ? etatsExecution(execution, edges) : null), [trace, execution, edges]);
  const affiches = useMemo(() => nodes.map((n) => {
    const courant = etats?.noeuds.get(n.id) === 'cours';
    return {
      ...n, draggable: modifiable,
      data: {
        ...n.data, figee: !modifiable, alerte: relies.has(n.id) ? undefined : 'non relié au départ',
        etat: etats ? etats.noeuds.get(n.id) ?? (trace ? 'saute' : 'attente') : undefined,
        direct: trace ? trace.directs.get(n.id) : courant && execution ? { texte: `${Math.round(execution.avancement * 100)} %` }
          : n.id === 'depart' && execution && execution.repetitions > 1 ? { texte: `tour ${execution.repetition}/${execution.repetitions}` } : undefined,
      },
    };
  }), [nodes, relies, etats, execution, modifiable, trace]);
  const liensAffiches = useMemo<LienCanevas[]>(() => edges.map((e) => ({
    ...e, data: { ...e.data!, etat: (etats?.liens.get(e.id) ?? 'aucun') as EtatLien, ton: tonDe(e.data!.sortie) },
  })), [edges, etats]);

  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    const m = versMission(nodes, edges);
    onChange(m.noeuds, m.liens);
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Un point de l'écran, ramené dans la boîte de l'éditeur et gardé à l'intérieur. */
  const dansLaBoite = (p: Point, w: number, h: number) => {
    const r = boite.current!.getBoundingClientRect();
    return { x: Math.max(8, Math.min(p.x - r.left, r.width - w)), y: Math.max(8, Math.min(p.y - r.top, r.height - h)) };
  };

  const actions = useMemo<ActionsCanevas>(() => ({
    ajouter: (id, sortie, ou) => setChoix({ ...dansLaBoite(ou, 250, 300), id, sortie: sortie as Sortie }),
    remplacer: () => {},
  }), []);

  /** Pose une primitive au bout d'une sortie (ou, sans sortie, au bout de la chaîne « réussi ») et la relie. */
  function ajouter(p: Primitive, depuisId?: string, sortie: Sortie = 'ok', position?: { x: number; y: number }) {
    const id = nouvelId('n');
    const source = depuisId ? nodes.find((n) => n.id === depuisId) : position ? undefined : boutDeChaine(nodes, edges);
    let pos = position ?? { x: (source?.position.x ?? 0) + COLONNE, y: (source?.position.y ?? 0) + (sortie === 'echec' ? RANGEE : 0) };
    while (!position && nodes.some((n) => Math.abs(n.position.x - pos.x) < 150 && Math.abs(n.position.y - pos.y) < 90)) pos = { ...pos, y: pos.y + RANGEE };
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), {
      id, type: 'carte', position: pos, selected: true, data: { type: typePrimitive(p), valeurs: { primitive: p.id } },
    }]);
    if (source) {
      const s = poignee(source.id, sortie);
      setEdges((es) => [...es.filter((e) => !(e.source === source.id && e.sourceHandle === s)), lien(nouvelId('l'), source.id, s, id)]);
    }
    if (!position) flot.setCenter(pos.x + 38, pos.y + 38, { duration: 300, zoom: flot.getZoom() });
  }

  function relier(c: Connection) {
    if (!c.source || !c.target || c.source === c.target) return;
    const sortie = poignee(c.source, c.sourceHandle === 'echec' ? 'echec' : 'ok');
    // Une sortie mène à une seule suite : relier à nouveau remplace l'ancien lien.
    setEdges((es) => [...es.filter((e) => !(e.source === c.source && e.sourceHandle === sortie)), lien(nouvelId('l'), c.source!, sortie, c.target!)]);
  }

  function deposer(e: DragEvent) {
    e.preventDefault();
    const p = parId.get(e.dataTransfer.getData(GLISSE));
    if (!p || !modifiable) return;
    const pos = flot.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    ajouter(p, undefined, 'ok', { x: pos.x - 38, y: pos.y - 38 });
  }

  function changerEchec(id: string, v: boolean) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, echec: v } } : n)));
    if (!v) setEdges((es) => es.filter((e) => !(e.source === id && e.sourceHandle === 'echec')));
  }

  function ouvrirMenu(e: MouseEvent, id: string) {
    e.preventDefault();
    setChoix(null);
    setMenu({ ...dansLaBoite({ x: e.clientX, y: e.clientY }, 200, 170), id });
  }
  const fermer = () => { setMenu(null); setChoix(null); };

  const noeudMenu = menu ? nodes.find((n) => n.id === menu.id) : undefined;
  const noeudReglages = reglages ? nodes.find((n) => n.id === reglages && n.id !== 'depart') : undefined;
  return (
    <Actions.Provider value={actions}>
      <div className={`em-editeur ${modifiable ? '' : 'em-editeur-lecture'}`} ref={boite} onClick={fermer}>
        <div className="em-editeur-canevas" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDrop={deposer}>
          <ReactFlow nodes={affiches} edges={liensAffiches} nodeTypes={TYPES_NOEUDS} edgeTypes={TYPES_LIENS} colorMode="dark"
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={relier}
            nodesConnectable={modifiable} elementsSelectable={modifiable} deleteKeyCode={modifiable ? ['Backspace', 'Delete'] : null}
            onNodeContextMenu={(e, n) => (modifiable && n.id !== 'depart' ? ouvrirMenu(e, n.id) : e.preventDefault())}
            onNodeDoubleClick={(_, n) => setReglages(n.id)} onPaneClick={fermer} zoomOnDoubleClick={false}
            fitView fitViewOptions={{ padding: 0.25, maxZoom: 1 }} minZoom={0.3} maxZoom={1.6} proOptions={{ hideAttribution: true }}>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a3038" />
            <Controls showInteractive={false} position="bottom-left" />
            {modifiable && (
              <MiniMap pannable zoomable position="bottom-right" maskColor="rgb(5 6 8 / 0.75)" style={{ background: '#0b0d10', width: 140, height: 84 }}
                nodeColor={(n) => teinte((n.data as NoeudCanevas['data']).type.famille, couleurs)} />
            )}
          </ReactFlow>
          {nodes.length <= 1 && modifiable && (
            <p className="em-editeur-aide">Touchez une primitive à droite pour l’ajouter au bout de la mission,<br />ou glissez-la où vous voulez puis reliez-la.</p>
          )}
          {modifiable && <p className="em-astuce" aria-hidden="true"><kbd>+</kbd> primitive suivante · <kbd>clic droit</kbd> actions · <kbd>double-clic</kbd> fiche</p>}
        </div>
        {modifiable && <Palette primitives={primitives} ajouter={(p) => ajouter(p)} />}
        {menu && noeudMenu && (
          <div className="em-menu" style={{ left: menu.x, top: menu.y }} role="menu" onClick={(e) => e.stopPropagation()}>
            <p>{noeudMenu.data.type.nom}</p>
            <button role="menuitem" className="em-menu-principal" onClick={() => { setReglages(menu.id); setMenu(null); }}><span aria-hidden="true">⚙</span>Fiche et réglages</button>
            {parId.has(String(noeudMenu.data.valeurs.primitive)) && (
              <button role="menuitem" onClick={() => {
                const p = parId.get(String(noeudMenu.data.valeurs.primitive));
                if (p) ajouter(p, undefined, 'ok', { x: noeudMenu.position.x + 30, y: noeudMenu.position.y + RANGEE });
                setMenu(null);
              }}><span aria-hidden="true">⧉</span>Dupliquer</button>
            )}
            <hr />
            <button role="menuitem" className="em-menu-suppr" onClick={() => {
              setNodes((ns) => ns.filter((n) => n.id !== menu.id));
              setEdges((es) => es.filter((e) => e.source !== menu.id && e.target !== menu.id));
              setMenu(null);
            }}><span aria-hidden="true">✕</span>Retirer de la mission</button>
          </div>
        )}
        {choix && (
          <Choisir x={choix.x} y={choix.y} primitives={primitives} choisir={(p) => { ajouter(p, choix.id, choix.sortie); setChoix(null); }} />
        )}
        {noeudReglages && (
          <Panneau t={noeudReglages.data.type} valeurs={noeudReglages.data.valeurs} primitive={parId.get(String(noeudReglages.data.valeurs.primitive))}
            echec={!!noeudReglages.data.echec} modifiable={modifiable}
            changerEchec={(v) => changerEchec(noeudReglages.id, v)} fermer={() => setReglages(null)} />
        )}
      </div>
    </Actions.Provider>
  );
}

/**
 * L'éditeur de missions dessiné comme n8n, sur les données de l'API : les primitives en tuiles, « réussi » tout droit,
 * « échec » en ambre quand la primitive l'ouvre, un « + » au bout des sorties libres, la palette à droite. Pendant une
 * exécution, il montre le chemin joué, l'étape en cours et l'onde qui y mène.
 */
export function EditeurMission(props: Props) {
  return <ReactFlowProvider><Canevas {...props} /></ReactFlowProvider>;
}
