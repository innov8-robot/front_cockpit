import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useRef, useState } from 'react';
import { FAMILLE, FAMILLES, SORTIES, STATUTS, type EtatNoeud, type Sortie } from './charte';
import { CATALOGUE, type TypeNoeud } from './catalogue';
import { IconeNoeud, NoeudCadre, NoeudCarte, type NoeudMission } from './Noeud';

const TYPES = { carte: NoeudCarte, cadre: NoeudCadre };
const T = (cle: string) => CATALOGUE.find((t) => t.cle === cle)!;

/** Un trait de lien selon la sortie : plein pour le chemin normal, pointillé ambre pour l'échec. */
function lien(id: string, source: string, sortie: Sortie | 'corps' | 'retour', target: string, cible?: string): Edge {
  const s = SORTIES[(sortie === 'retour' ? 'suite' : sortie) as Sortie];
  return {
    id, source, target, sourceHandle: sortie === 'retour' ? undefined : sortie, targetHandle: cible,
    type: 'smoothstep', label: sortie === 'echec' || sortie === 'faux' ? s.libelle : undefined,
    style: { stroke: s.couleur, strokeWidth: 1.6, strokeDasharray: s.pointille ? '6 5' : undefined, opacity: 0.85 },
    labelStyle: { fill: s.couleur, fontSize: 10, fontFamily: 'ui-monospace, monospace' }, labelBgStyle: { fill: '#0b0d10' },
    markerEnd: { type: MarkerType.ArrowClosed, color: s.couleur, width: 14, height: 14 },
  };
}

/**
 * La mission d'exemple, écrite avec le catalogue : « Vider la table dans le bac ». Pour chaque pièce vue, prendre
 * (réessayer deux fois), déposer, compter ; une prise qui échoue encore appelle l'opérateur ; à la fin, rentrer les
 * bras et retourner à la base.
 */
function exemple(): { nodes: NoeudMission[]; edges: Edge[] } {
  const carte = (id: string, cle: string, x: number, y: number, valeurs = {}, parentId?: string): NoeudMission => ({
    id, type: 'carte', position: { x, y }, data: { type: T(cle), valeurs }, ...(parentId ? { parentId, extent: 'parent' as const } : {}),
  });
  const cadre = (id: string, cle: string, x: number, y: number, w: number, h: number, valeurs = {}, parentId?: string): NoeudMission => ({
    id, type: 'cadre', position: { x, y }, style: { width: w, height: h }, data: { type: T(cle), valeurs },
    ...(parentId ? { parentId, extent: 'parent' as const } : {}),
  });
  const nodes: NoeudMission[] = [
    carte('depart', 'au_lancement', 0, 150),
    carte('aller', 'deplacer', 300, 150, { poste: 'table' }),
    cadre('boucle', 'pour_chaque', 600, 40, 880, 400, { objet: 'pièce Novares' }),
    cadre('essai', 'essayer', 40, 110, 330, 250, { fois: 2 }, 'boucle'),
    carte('prendre', 'prise_objet', 46, 108, { primitive: 'Prendre la pièce Novares' }, 'essai'),
    carte('deposer', 'depose_objet', 430, 110, { primitive: 'Déposer dans le bac B' }, 'boucle'),
    carte('compter', 'compteur', 430, 260, { variable: 'pièces déposées' }, 'boucle'),
    carte('appel', 'demander', 600, 500, { message: 'Pièce imprenable : retirez-la' }),
    carte('rentrer', 'rentrer', 1560, 150),
    carte('base', 'deplacer', 1860, 150, { poste: 'base' }),
    carte('fin', 'terminer', 2160, 150, { verdict: 'réussie' }),
  ];
  const edges: Edge[] = [
    lien('e1', 'depart', 'suite', 'aller'),
    lien('e2', 'aller', 'ok', 'boucle'),
    lien('e3', 'boucle', 'corps', 'essai'),
    lien('e4', 'essai', 'corps', 'prendre'),
    lien('e5', 'prendre', 'ok', 'essai', 'retour'),
    lien('e6', 'essai', 'ok', 'deposer'),
    lien('e7', 'deposer', 'ok', 'compter'),
    lien('e8', 'compter', 'suite', 'boucle', 'retour'),
    lien('e9', 'essai', 'echec', 'appel'),
    lien('e10', 'boucle', 'fini', 'rentrer'),
    lien('e11', 'rentrer', 'ok', 'base'),
    lien('e12', 'base', 'ok', 'fin'),
  ];
  return { nodes, edges };
}

/** Le déroulé simulé : quel nœud est en cours, puis réussi, à chaque pas (deux pièces, une prise qui rate une fois). */
const DEROULE: [string, EtatNoeud][] = [
  ['depart', 'ok'], ['aller', 'cours'], ['aller', 'ok'], ['boucle', 'cours'], ['essai', 'cours'], ['prendre', 'cours'],
  ['prendre', 'echec'], ['prendre', 'cours'], ['prendre', 'ok'], ['essai', 'ok'], ['deposer', 'cours'], ['deposer', 'ok'],
  ['compter', 'ok'], ['boucle', 'ok'], ['rentrer', 'cours'], ['rentrer', 'ok'], ['base', 'cours'], ['base', 'ok'], ['fin', 'ok'],
];

/** Le panneau d'un nœud, façon n8n : ce qui arrive, les réglages, ce qui sort. */
function Panneau({ noeud, fermer }: { noeud: NoeudMission; fermer(): void }) {
  const t: TypeNoeud = noeud.data.type;
  const f = FAMILLE[t.famille];
  return (
    <aside className="em-panneau" aria-label={`Réglages de ${t.nom}`}>
      <header className="em-panneau-tete" style={{ ['--famille' as string]: f.couleur }}>
        <IconeNoeud nom={t.icone} couleur={f.couleur} taille={18} />
        <div><p>{f.nom}</p><h3>{t.nom}</h3></div>
        <button onClick={fermer} aria-label="Fermer">×</button>
      </header>
      <div className="em-panneau-colonnes">
        <section>
          <p className="em-panneau-titre">IL LUI FAUT</p>
          {t.prerequis?.length ? <ul>{t.prerequis.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="em-discret">Rien de particulier.</p>}
          <p className="em-panneau-titre em-panneau-statut">{STATUTS[t.statut].libelle.toUpperCase()}</p>
          <p className="em-discret">{t.aujourdhui ?? STATUTS[t.statut].aide}</p>
        </section>
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
          <p className="em-panneau-titre">CE QUI SORT</p>
          <ul>{t.sorties.filter((s) => SORTIES[s].libelle).map((s) => <li key={s}><b style={{ color: SORTIES[s].couleur }}>{SORTIES[s].libelle}</b></li>)}</ul>
          {t.produit?.length ? <><p className="em-panneau-titre">FOURNIT À LA SUITE</p><ul>{t.produit.map((p) => <li key={p}>{p}</li>)}</ul></> : null}
          {t.issues?.length ? <><p className="em-panneau-titre">ÉCHECS POSSIBLES</p><ul className="em-issues">{t.issues.map((p) => <li key={p}>{p}</li>)}</ul></> : null}
        </section>
      </div>
      <p className="em-panneau-aide">{t.aide}</p>
    </aside>
  );
}

/** La palette : les nœuds rangés par famille, avec une recherche. */
function Palette() {
  const [cherche, setCherche] = useState('');
  const visibles = CATALOGUE.filter((t) => `${t.nom} ${t.phrase}`.toLowerCase().includes(cherche.toLowerCase()));
  return (
    <aside className="em-palette" aria-label="Nœuds">
      <input className="em-recherche" placeholder="Chercher un nœud…" value={cherche} onChange={(e) => setCherche(e.target.value)} />
      {FAMILLES.map((f) => {
        const ts = visibles.filter((t) => t.famille === f.cle);
        if (!ts.length) return null;
        return (
          <div key={f.cle} className="em-palette-famille">
            <p style={{ color: f.couleur }}>{f.nom.toUpperCase()}</p>
            {ts.map((t) => (
              <div key={t.cle} className="em-palette-item" title={t.aide} style={{ ['--famille' as string]: f.couleur }}>
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

function Canevas() {
  const depart = useMemo(() => exemple(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<NoeudMission>(depart.nodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(depart.edges);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [pas, setPas] = useState(-1);
  const minuterie = useRef<number | undefined>(undefined);

  /** Rejoue le déroulé jusqu'au pas `k` : chaque nœud prend son dernier état ; les autres attendent. */
  function poserEtats(k: number) {
    const etats = new Map<string, EtatNoeud>();
    DEROULE.slice(0, k + 1).forEach(([id, e]) => etats.set(id, e));
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, etat: k < 0 ? undefined : etats.get(n.id) ?? (n.id === 'appel' && k === DEROULE.length - 1 ? 'saute' : 'attente') } })));
  }
  function simuler() {
    clearInterval(minuterie.current);
    let k = -1;
    minuterie.current = window.setInterval(() => {
      k += 1;
      setPas(k);
      poserEtats(k);
      if (k >= DEROULE.length - 1) clearInterval(minuterie.current);
    }, 650);
  }
  function remettre() {
    clearInterval(minuterie.current);
    setPas(-1);
    poserEtats(-1);
  }

  const noeudChoisi = nodes.find((n) => n.id === choisi);
  return (
    <div className="em-prototype">
      <Palette />
      <div className="em-canevas">
        <div className="em-barre-outils">
          <span className="em-titre-mission">Vider la table dans le bac</span>
          <span className="em-pill-ok">✓ Vérifiée</span>
          <span className="em-espace" />
          <span className="em-chrono">{pas >= 0 ? `pas ${Math.min(pas + 1, DEROULE.length)} / ${DEROULE.length}` : 'simulation prête'}</span>
          <button onClick={remettre}>Remettre à zéro</button>
          <button className="em-lancer" onClick={simuler}>▶ Simuler</button>
        </div>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={TYPES} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={(_, n) => setChoisi(n.id)} onPaneClick={() => setChoisi(null)} fitView fitViewOptions={{ padding: 0.12 }}
          minZoom={0.2} proOptions={{ hideAttribution: true }} colorMode="dark">
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a3038" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => FAMILLE[(n.data as NoeudMission['data']).type.famille].couleur}
            maskColor="rgb(5 6 8 / 0.75)" style={{ background: '#0b0d10' }} />
        </ReactFlow>
      </div>
      {noeudChoisi && <Panneau noeud={noeudChoisi} fermer={() => setChoisi(null)} />}
    </div>
  );
}

/** Le prototype interactif de l'éditeur : palette, canevas, panneau, simulation d'une exécution. */
export function Prototype() {
  return <ReactFlowProvider><Canevas /></ReactFlowProvider>;
}

