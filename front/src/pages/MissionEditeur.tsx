import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ETATS_MISSION, nbPrimitives } from '../api/libelles';
import type { LienMission, Mission, NoeudMission } from '../api/types';
import { EditeurGraphe } from '../components/graphe/EditeurGraphe';
import { Badge, Chargement, Erreur, Icone, Vide } from '../components/ui';
import { useCharge } from '../components/useCharge';

const vierge = (): Mission => ({
  id: '', nom: '', description: '', robotId: null, repetitions: 1, etat: 'brouillon', modifieeLe: '',
  noeuds: [{ id: 'depart', primitiveId: null, x: 0, y: 80 }], liens: [],
});

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

export function MissionEditeur() {
  const { id } = useParams();
  const nouvelle = !id || id === 'nouvelle';
  const naviguer = useNavigate();
  const source = useCharge(() => (nouvelle ? Promise.resolve(vierge()) : api.mission(id!)), [id]);
  const primitives = useCharge(() => api.primitives());
  const robots = useCharge(() => api.robots());
  const [m, setM] = useState<Mission | null>(null);
  const [message, setMessage] = useState<{ ton: 'ok' | 'danger'; texte: string } | null>(null);

  useEffect(() => { if (source.donnee) setM(source.donnee); }, [source.donnee]);

  if ((source.enCours && !m) || !primitives.donnee) return <Chargement />;
  if (!m) return <Vide titre="Mission introuvable"><Link to="/missions">Retour aux missions</Link></Vide>;

  const maj = (champs: Partial<Mission>) => setM((x) => (x ? { ...x, ...champs } : x));
  const enCours = m.etat === 'en_cours';
  const robotChoisi = robots.donnee?.find((r) => r.id === m.robotId);
  const nbJoues = joues(m);
  const nbIsoles = nbPrimitives(m) - nbJoues;

  async function enregistrer(): Promise<Mission | null> {
    try {
      const etat = nbJoues > 0 && m!.etat === 'brouillon' ? 'prete' : m!.etat;
      const sauvee = await api.enregistrerMission({ ...m!, etat });
      setM(sauvee);
      setMessage({ ton: 'ok', texte: 'Mission enregistrée.' });
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
      setMessage({ ton: 'ok', texte: 'Mission lancée.' });
      source.recharger();
    } catch (e) {
      setMessage({ ton: 'danger', texte: e instanceof Error ? e.message : String(e) });
    }
  }

  async function supprimer() {
    if (!confirm(`Supprimer « ${m!.nom || 'cette mission'} » ?`)) return;
    await api.supprimerMission(m!.id);
    naviguer('/missions');
  }

  return (
    <div className="page-graphe">
      <div className="graphe-barre">
        <Link to="/missions" className="retour"><Icone nom="retour" taille={16} />Missions</Link>
        <input className="graphe-nom" value={m.nom} onChange={(e) => maj({ nom: e.target.value })} disabled={enCours}
          placeholder="Nom de la mission" aria-label="Nom de la mission" />
        <Badge ton={ETATS_MISSION[m.etat].ton}>{ETATS_MISSION[m.etat].libelle}</Badge>
        <span className="espace" />
        <select value={m.robotId ?? ''} onChange={(e) => maj({ robotId: e.target.value || null })} disabled={enCours} aria-label="Robot">
          <option value="">Robot : non assigné</option>
          {robots.donnee?.map((r) => (
            <option key={r.id} value={r.id} disabled={r.etat === 'hors_ligne'}>{r.nom} · {r.site}</option>
          ))}
        </select>
        <label className="graphe-repet">×
          <input type="number" min={1} max={999} value={m.repetitions} disabled={enCours} aria-label="Répétitions"
            onChange={(e) => maj({ repetitions: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
        {!nouvelle && !enCours && <button className="bouton bouton-discret" onClick={supprimer}>Supprimer</button>}
        {!enCours && <button className="bouton" disabled={!m.nom.trim()} onClick={enregistrer}>Enregistrer</button>}
        {!enCours && (
          <button className="bouton bouton-primaire" onClick={lancer}
            disabled={!m.nom.trim() || nbJoues === 0 || robotChoisi?.etat !== 'disponible'}
            title={robotChoisi && robotChoisi.etat !== 'disponible' ? `${robotChoisi.nom} n’est pas disponible` : undefined}>
            <Icone nom="jouer" taille={16} />Lancer
          </button>
        )}
      </div>

      {message && <div className={`alerte alerte-${message.ton}`}>{message.texte}</div>}
      {source.erreur && <Erreur message={source.erreur} />}
      <p className="graphe-etat discret">
        {nbJoues} primitive{nbJoues > 1 ? 's' : ''} jouée{nbJoues > 1 ? 's' : ''}
        {nbIsoles > 0 && <span className="texte-alerte"> · {nbIsoles} non reliée{nbIsoles > 1 ? 's' : ''} au départ</span>}
        {enCours && ' · mission en cours, lecture seule'}
      </p>

      <EditeurGraphe key={m.id || 'nouvelle'} noeuds={m.noeuds} liens={m.liens} primitives={primitives.donnee}
        modifiable={!enCours}
        onChange={(noeuds: NoeudMission[], liens: LienMission[]) => maj({ noeuds, liens })} />
    </div>
  );
}
