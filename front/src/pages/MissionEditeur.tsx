import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, robotUnique } from '../api/client';
import { nbPrimitives } from '../api/libelles';
import type { EtatMission, Execution, LienMission, Mission, NoeudMission, Run } from '../api/types';
import { OngletAnalyse } from '../components/executions/OngletAnalyse';
import { OngletExecutions } from '../components/executions/OngletExecutions';
import { EditeurMission } from '../components/graphe/EditeurMission';
import { MenuMission, PointEtat, Trait } from '../components/listeMissions/Pieces';
import { Chargement, Erreur, Vide } from '../components/ui';
import { useCharge } from '../components/useCharge';

const vierge = (): Mission => ({
  id: '', nom: '', description: '', robotId: null, repetitions: 1, etat: 'brouillon', modifieeLe: '',
  noeuds: [{ id: 'depart', primitiveId: null, x: 0, y: 80 }], liens: [],
});

/** Les onglets de l'éditeur, comme ceux de n8n : le canevas, les runs passés, ce qu'ils disent de la mission. */
const ONGLETS = [
  { cle: 'editeur', libelle: 'Éditeur' },
  { cle: 'executions', libelle: 'Exécutions' },
  { cle: 'analyse', libelle: 'Analyse' },
] as const;
type Onglet = (typeof ONGLETS)[number]['cle'];

/** Les runs de la mission, relus chaque seconde pendant une mission, sinon toutes les cinq. */
function useRuns(missionId: string | undefined, enDirect: boolean): Run[] {
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => {
    if (!missionId) return;
    let vivant = true;
    const lire = () => api.runs({ missionId }).then((r) => vivant && setRuns(r)).catch(() => undefined);
    lire();
    const t = setInterval(lire, enDirect ? 1000 : 5000);
    return () => { vivant = false; clearInterval(t); };
  }, [missionId, enDirect]);
  return missionId ? runs : [];
}

/** Un message de la barre (enregistrée, lancée, une erreur) s'efface seul après ce temps. */
const MESSAGE_MS = 3000;

/** La mission en cours sur le robot, relue chaque seconde tant qu'elle est celle qu'on regarde. */
function useExecution(robotId: string | undefined, missionId: string, active: boolean, fini: () => void): Execution | null {
  const [execution, setExecution] = useState<Execution | null>(null);
  useEffect(() => {
    if (!robotId || !active) return;
    let vivant = true;
    const lire = () => api.execution(robotId).then((x) => {
      if (!vivant) return;
      setExecution(x?.missionId === missionId ? x : null);
      if (!x) fini();
    }).catch(() => undefined);
    lire();
    const t = setInterval(lire, 1000);
    return () => { vivant = false; clearInterval(t); };
  }, [robotId, missionId, active]); // eslint-disable-line react-hooks/exhaustive-deps
  return active ? execution : null;
}

/** Les nœuds joués : ceux qu'on atteint depuis le départ. */
function joues(m: Mission): number {
  const vus = new Set(['depart']);
  const pile = ['depart'];
  while (pile.length) {
    const n = pile.pop()!;
    for (const l of m.liens) if (l.de === n && !vus.has(l.vers)) { vus.add(l.vers); pile.push(l.vers); }
  }
  return m.noeuds.filter((n) => n.primitiveId && vus.has(n.id)).length;
}

/** Le nombre de répétitions d'une mission, dans le menu ⋯ : moins, la valeur, plus. */
function Repetitions({ valeur, changer, figee }: { valeur: number; changer(n: number): void; figee: boolean }) {
  return (
    <div className="me-repetitions">
      <span>Répéter</span>
      <button className="lm-bouton lm-carre-petit" disabled={figee || valeur <= 1} onClick={() => changer(valeur - 1)} aria-label="Une répétition de moins">−</button>
      <b>×{valeur}</b>
      <button className="lm-bouton lm-carre-petit" disabled={figee || valeur >= 999} onClick={() => changer(valeur + 1)} aria-label="Une répétition de plus">+</button>
    </div>
  );
}

export function MissionEditeur() {
  const { id } = useParams();
  const nouvelle = !id || id === 'nouvelle';
  const naviguer = useNavigate();
  const source = useCharge(() => (nouvelle ? Promise.resolve(vierge()) : api.mission(id!)), [id]);
  const primitives = useCharge(() => api.primitives());
  const robot = useCharge(robotUnique);
  const [m, setM] = useState<Mission | null>(null);
  const [message, setMessage] = useState<{ ton: 'ok' | 'danger'; texte: string } | null>(null);
  const champNom = useRef<HTMLInputElement>(null);
  const execution = useExecution(robot.donnee?.id, m?.id ?? '', m?.etat === 'en_cours', source.recharger);
  const [recherche, setRecherche] = useSearchParams();
  const onglet: Onglet = nouvelle ? 'editeur' : (ONGLETS.find((o) => o.cle === recherche.get('onglet'))?.cle ?? 'editeur');
  const runs = useRuns(nouvelle ? undefined : id, m?.etat === 'en_cours');
  const ouvrir = (o: Onglet) => setRecherche(o === 'editeur' ? {} : { onglet: o }, { replace: true });

  useEffect(() => { if (source.donnee) setM(source.donnee); }, [source.donnee]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(t);
  }, [message]);

  if ((source.enCours && !m) || !primitives.donnee) return <Chargement />;
  if (!m) return <Vide titre="Mission introuvable"><Link to="/missions">Retour aux missions</Link></Vide>;

  const maj = (champs: Partial<Mission>) => setM((x) => (x ? { ...x, ...champs } : x));
  const enCours = m.etat === 'en_cours';
  const robotChoisi = robot.donnee;
  const nbJoues = joues(m);
  const nbIsoles = nbPrimitives(m) - nbJoues;
  const etat: EtatMission = execution ? 'en_cours' : m.etat === 'en_cours' ? 'prete' : m.etat;
  const pourquoiPas = !m.nom.trim() ? 'Donnez un nom à la mission' : nbJoues === 0 ? 'Reliez au moins une primitive au départ'
    : robotChoisi?.etat !== 'disponible' ? `${robotChoisi?.nom ?? 'Le robot'} n’est pas disponible` : null;

  async function enregistrer(): Promise<Mission | null> {
    try {
      const etatSauve = nbJoues > 0 && m!.etat === 'brouillon' ? 'prete' : m!.etat;
      const sauvee = await api.enregistrerMission({ ...m!, etat: etatSauve, robotId: robotChoisi?.id ?? null });
      setM(sauvee);
      setMessage({ ton: 'ok', texte: 'Enregistrée' });
      if (nouvelle) naviguer(`/missions/${sauvee.id}`, { replace: true });
      return sauvee;
    } catch (e) {
      setMessage({ ton: 'danger', texte: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }

  async function lancer() {
    const sauvee = await enregistrer();
    if (!sauvee?.robotId) return;
    try {
      await api.lancerMission(sauvee.id, sauvee.robotId);
      setMessage({ ton: 'ok', texte: 'Lancée' });
      source.recharger();
    } catch (e) {
      setMessage({ ton: 'danger', texte: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="page-graphe">
      <div className="me-barre">
        <Link to="/missions" className="me-retour"><Trait d="M15 6l-6 6 6 6" />Missions</Link>
        <span className="me-separateur" aria-hidden="true" />
        <input ref={champNom} className="me-nom" value={m.nom} onChange={(e) => maj({ nom: e.target.value })} disabled={enCours}
          placeholder="Nom de la mission" aria-label="Nom de la mission" />
        <PointEtat etat={etat} />
        <span className="me-info">
          {nbJoues} primitive{nbJoues > 1 ? 's' : ''}
          {m.repetitions > 1 && <> · ×{m.repetitions}</>}
          {nbIsoles > 0 && <span className="me-alerte"> · {nbIsoles} non reliée{nbIsoles > 1 ? 's' : ''}</span>}
          {enCours && ' · lecture seule'}
        </span>
        <span className="lm-espace" />
        <span className="lm-filtres me-onglets" role="tablist" aria-label="Vues de la mission">
          {ONGLETS.map((o) => (
            <button key={o.cle} role="tab" aria-selected={onglet === o.cle} className={onglet === o.cle ? 'actif' : ''}
              disabled={nouvelle && o.cle !== 'editeur'} title={nouvelle && o.cle !== 'editeur' ? 'Enregistrez la mission d’abord' : undefined}
              onClick={() => ouvrir(o.cle)}>
              {o.libelle}{o.cle === 'executions' && runs.filter((r) => r.dureeS > 0).length > 0 && <b>{runs.filter((r) => r.dureeS > 0).length}</b>}
              {o.cle === 'executions' && execution && <i className="me-onglet-direct" aria-label="mission en cours" />}
            </button>
          ))}
        </span>
        <span className="lm-espace" />
        {message && <span className={`me-message me-message-${message.ton}`} role="status">{message.texte}</span>}
        <MenuMission m={m} enCours={enCours} grand dansEditeur relire={source.recharger}
          renommer={() => champNom.current?.focus()}
          apresDuplication={(copie) => naviguer(`/missions/${copie.id}`)} apresSuppression={() => naviguer('/missions')}
          enPlus={<Repetitions valeur={m.repetitions} figee={enCours} changer={(n) => maj({ repetitions: n })} />} />
        {!enCours && <button className="lm-bouton lm-36" disabled={!m.nom.trim()} onClick={enregistrer}>Enregistrer</button>}
        {!enCours && (
          <button className="lm-bouton lm-lancer lm-36" onClick={lancer} disabled={pourquoiPas !== null} title={pourquoiPas ?? 'Enregistrer et lancer la mission'}>
            <Trait d="M8 5l11 7-11 7z" taille={13} />Lancer
          </button>
        )}
        <Link className="lm-carre" to="/" aria-label="Fermer"><Trait d="M6 6l12 12M18 6L6 18" taille={18} /></Link>
      </div>

      {source.erreur && <Erreur message={source.erreur} />}
      {onglet === 'executions' ? (
        <OngletExecutions m={m} primitives={primitives.donnee} runs={runs} execution={execution} voirEditeur={() => ouvrir('editeur')} />
      ) : onglet === 'analyse' ? (
        <OngletAnalyse m={m} primitives={primitives.donnee} runs={runs} />
      ) : (
        <EditeurMission key={`${m.id || 'nouvelle'}-${enCours}`} noeuds={m.noeuds} liens={m.liens} primitives={primitives.donnee}
          modifiable={!enCours} execution={execution}
          onChange={(noeuds: NoeudMission[], liens: LienMission[]) => maj({ noeuds, liens })} />
      )}
    </div>
  );
}
