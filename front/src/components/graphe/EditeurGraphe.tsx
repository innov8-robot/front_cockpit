import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, useEdgesState,
  useNodesState, useReactFlow, type Connection, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { TYPES_PRIMITIVE } from '../../api/libelles';
import type { LienMission, NoeudMission, Primitive, Sortie, TypePrimitive } from '../../api/types';
import { COULEURS_TYPE, NoeudPrimitive, type NoeudGraphe } from './NoeudPrimitive';

const TYPES_NOEUDS = { primitive: NoeudPrimitive };
const GLISSE = 'application/x-primitive';

interface Props {
  noeuds: NoeudMission[];
  liens: LienMission[];
  primitives: Primitive[];
  modifiable: boolean;
  onChange(noeuds: NoeudMission[], liens: LienMission[]): void;
}

const nouvelId = (prefixe: string) => `${prefixe}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function styleLien(sortie: Sortie): Partial<Edge> {
  const couleur = sortie === 'ok' ? '#c9d3e6' : '#ff2d3a';
  return {
    type: 'smoothstep',
    label: sortie === 'echec' ? 'échoué' : undefined,
    style: { stroke: couleur, strokeWidth: 1.6, strokeDasharray: sortie === 'echec' ? '6 5' : undefined },
    markerEnd: { type: MarkerType.ArrowClosed, color: couleur, width: 16, height: 16 },
    labelStyle: { fill: '#ff6b73', fontSize: 11 },
    labelBgStyle: { fill: '#0b0d10' },
  };
}

/** Le dernier nœud de la chaîne « réussi » qui part du départ : là où un clic ajoute la suite. */
function boutDeChaine(nodes: NoeudGraphe[], edges: Edge[]): NoeudGraphe {
  let courant = nodes.find((n) => n.data.depart) ?? nodes[0];
  const vus = new Set<string>();
  for (;;) {
    vus.add(courant.id);
    const suite = edges.find((e) => e.source === courant.id && (e.sourceHandle ?? 'ok') === 'ok');
    const prochain = suite && nodes.find((n) => n.id === suite.target);
    if (!prochain || vus.has(prochain.id)) return courant;
    courant = prochain;
  }
}

/** Les nœuds qu'on atteint depuis le départ en suivant les liens : les autres ne seront jamais joués. */
function atteignables(liens: { source: string; target: string }[]): Set<string> {
  const vus = new Set(['depart']);
  const pile = ['depart'];
  while (pile.length) {
    const n = pile.pop()!;
    for (const l of liens) if (l.source === n && !vus.has(l.target)) { vus.add(l.target); pile.push(l.target); }
  }
  return vus;
}

function Canevas({ noeuds, liens, primitives, modifiable, onChange }: Props) {
  const flot = useReactFlow();
    const parId = useMemo(() => new Map(primitives.map((p) => [p.id, p])), [primitives]);

  const [nodes, setNodes, onNodesChange] = useNodesState<NoeudGraphe>(
    noeuds.map((n) => ({
      id: n.id, type: 'primitive', position: { x: n.x, y: n.y }, deletable: n.primitiveId !== null && modifiable,
      data: { primitive: n.primitiveId ? parId.get(n.primitiveId) ?? null : null, depart: n.primitiveId === null, relie: true, modifiable },
    })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    liens.map((l) => ({ id: l.id, source: l.de, sourceHandle: l.sortie, target: l.vers, ...styleLien(l.sortie) })),
  );

  const supprimer = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  // Le marquage « non relié » et le bouton de suppression se recalculent quand le graphe change.
  const relies = useMemo(() => atteignables(edges), [edges]);
  const affiches = useMemo(() => nodes.map((n) => ({
    ...n, data: { ...n.data, relie: n.data.depart || relies.has(n.id), supprimer: () => supprimer(n.id) },
  })), [nodes, relies, supprimer]);

  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    onChange(
      nodes.map((n) => ({ id: n.id, primitiveId: n.data.primitive?.id ?? null, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
      edges.map((e) => ({ id: e.id, de: e.source, sortie: (e.sourceHandle ?? 'ok') as Sortie, vers: e.target })),
    );
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  const relier = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const sortie = (c.sourceHandle ?? 'ok') as Sortie;
    // Une sortie mène à une seule suite : relier à nouveau remplace l'ancien lien.
    setEdges((es) => [
      ...es.filter((e) => !(e.source === c.source && (e.sourceHandle ?? 'ok') === sortie)),
      { id: nouvelId('l'), source: c.source!, sourceHandle: sortie, target: c.target!, ...styleLien(sortie) },
    ]);
  }, [setEdges]);

  /** Pose une primitive : là où on la lâche, ou, au clic, au bout de la chaîne « réussi » et reliée à elle. */
  const ajouter = useCallback((p: Primitive, position?: { x: number; y: number }) => {
    const id = nouvelId('n');
    let pos = position;
    if (!pos) {
      const bout = boutDeChaine(nodes, edges);
      pos = { x: bout.position.x + (bout.data.depart ? 250 : 310), y: bout.position.y };
      while (nodes.some((n) => Math.abs(n.position.x - pos!.x) < 200 && Math.abs(n.position.y - pos!.y) < 70)) pos.y += 100;
      setEdges((es) => [...es, { id: nouvelId('l'), source: bout.id, sourceHandle: 'ok', target: id, ...styleLien('ok') }]);
      flot.setCenter(pos.x + 130, pos.y + 36, { duration: 300, zoom: flot.getZoom() });
    }
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), {
      id, type: 'primitive', position: pos!, deletable: true, selected: true,
      data: { primitive: p, depart: false, relie: false, modifiable: true },
    }]);
  }, [flot, nodes, edges, setNodes, setEdges]);

  function deposer(e: DragEvent) {
    e.preventDefault();
    const p = parId.get(e.dataTransfer.getData(GLISSE));
    if (!p) return;
    const pos = flot.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    ajouter(p, { x: pos.x - 110, y: pos.y - 36 });
  }

  return (
    <div className="editeur-graphe">
      {modifiable && <Palette primitives={primitives} ajouter={(p) => ajouter(p)} />}
      <div className="graphe-canevas" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDrop={deposer}>
        <ReactFlow
          nodes={affiches} edges={edges} nodeTypes={TYPES_NOEUDS} colorMode="dark"
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={relier}
          nodesDraggable={modifiable} nodesConnectable={modifiable} elementsSelectable={modifiable}
          deleteKeyCode={modifiable ? ['Backspace', 'Delete'] : null}
          fitView fitViewOptions={{ padding: 0.25, maxZoom: 1 }} minZoom={0.3} maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#2a3038" />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap pannable zoomable position="top-right" nodeColor={(n) => {
            const p = (n.data as NoeudGraphe['data']).primitive;
            return p ? COULEURS_TYPE[p.type] : '#ff2d3a';
          }} maskColor="rgb(5 6 8 / 0.7)" bgColor="#0b0d10" />
        </ReactFlow>
        {nodes.length <= 1 && (
          <div className="graphe-aide">Touchez une primitive pour l’ajouter au bout de la mission,<br />
            ou glissez-la où vous voulez puis reliez-la.</div>
        )}
      </div>
    </div>
  );
}

function Palette({ primitives, ajouter }: { primitives: Primitive[]; ajouter(p: Primitive): void }) {
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState(true);
  const groupes = (Object.keys(TYPES_PRIMITIVE) as TypePrimitive[])
    .map((t) => ({ t, ps: primitives.filter((p) => p.type === t && p.nom.toLowerCase().includes(recherche.toLowerCase())) }))
    .filter((g) => g.ps.length);

  return (
    <aside className={`palette ${ouverte ? '' : 'fermee'}`}>
      <button className="palette-entete" onClick={() => setOuverte(!ouverte)} aria-expanded={ouverte}>
        <span>Primitives</span><span className="palette-compte nombre">{primitives.length}</span>
      </button>
      {ouverte && (
        <>
          <input type="search" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <div className="palette-liste">
            {groupes.map(({ t, ps }) => (
              <section key={t}>
                <h3 style={{ color: COULEURS_TYPE[t] }}>{TYPES_PRIMITIVE[t].libelle}</h3>
                {ps.map((p) => (
                  <button key={p.id} className="palette-item" draggable
                    onDragStart={(e) => { e.dataTransfer.setData(GLISSE, p.id); e.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => ajouter(p)} style={{ ['--couleur' as string]: COULEURS_TYPE[t] }}>
                    <span className="palette-point" />
                    <span className="palette-nom">{p.nom}</span>
                    <span className="palette-plus" aria-hidden="true">+</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

export function EditeurGraphe(props: Props) {
  return (
    <ReactFlowProvider>
      <Canevas {...props} />
    </ReactFlowProvider>
  );
}
