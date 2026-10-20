import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ETATS_MISSION, TYPES_PRIMITIVE } from '../api/libelles';
import type { Mission } from '../api/types';
import { Badge, Chargement, EnTete, Erreur, Icone, Vide } from '../components/ui';
import { useCharge } from '../components/useCharge';

const vierge = (): Mission => ({
  id: '', nom: '', description: '', etapes: [], robotId: null, repetitions: 1, etat: 'brouillon', modifieeLe: '',
});

export function MissionEditeur() {
  const { id } = useParams();
  const nouvelle = !id || id === 'nouvelle';
  const naviguer = useNavigate();
  const source = useCharge(() => (nouvelle ? Promise.resolve(vierge()) : api.mission(id!)), [id]);
  const primitives = useCharge(() => api.primitives());
  const robots = useCharge(() => api.robots());
  const [m, setM] = useState<Mission | null>(null);
  const [ajout, setAjout] = useState('');
  const [message, setMessage] = useState<{ ton: 'ok' | 'danger'; texte: string } | null>(null);

  useEffect(() => { if (source.donnee) setM(source.donnee); }, [source.donnee]);

  if (source.enCours && !m) return <Chargement />;
  if (!m) return <Vide titre="Mission introuvable"><Link to="/missions">Retour aux missions</Link></Vide>;

  const primitive = (pid: string) => primitives.donnee?.find((p) => p.id === pid);
  const maj = (champs: Partial<Mission>) => setM({ ...m, ...champs });
  const enCours = m.etat === 'en_cours';

  function deplacer(i: number, sens: -1 | 1) {
    const etapes = [...m!.etapes];
    [etapes[i], etapes[i + sens]] = [etapes[i + sens], etapes[i]];
    maj({ etapes });
  }

  function ajouter() {
    if (!ajout) return;
    maj({ etapes: [...m!.etapes, { id: crypto.randomUUID(), primitiveId: ajout }] });
    setAjout('');
  }

  async function enregistrer(): Promise<Mission | null> {
    try {
      const sauvee = await api.enregistrerMission({ ...m!, etat: m!.etapes.length && m!.etat === 'brouillon' ? 'prete' : m!.etat });
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

  const robotChoisi = robots.donnee?.find((r) => r.id === m.robotId);

  return (
    <>
      <Link to="/missions" className="retour"><Icone nom="retour" taille={16} />Missions</Link>
      <EnTete titre={nouvelle ? 'Nouvelle mission' : m.nom || 'Mission'}
        actions={<Badge ton={ETATS_MISSION[m.etat].ton}>{ETATS_MISSION[m.etat].libelle}</Badge>} />

      {message && <div className={`alerte alerte-${message.ton}`}>{message.texte}</div>}
      {source.erreur && <Erreur message={source.erreur} />}

      <section className="carte formulaire">
        <label>Nom
          <input value={m.nom} onChange={(e) => maj({ nom: e.target.value })} disabled={enCours} placeholder="Ex. Vider la table" />
        </label>
        <label>Description
          <textarea rows={2} value={m.description} onChange={(e) => maj({ description: e.target.value })} disabled={enCours} />
        </label>
        <div className="deux-colonnes">
          <label>Robot
            <select value={m.robotId ?? ''} onChange={(e) => maj({ robotId: e.target.value || null })} disabled={enCours}>
              <option value="">Non assignée</option>
              {robots.donnee?.map((r) => (
                <option key={r.id} value={r.id} disabled={r.etat === 'hors_ligne'}>{r.nom} · {r.site}</option>
              ))}
            </select>
          </label>
          <label>Répétitions
            <input type="number" min={1} max={999} value={m.repetitions} disabled={enCours}
              onChange={(e) => maj({ repetitions: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
        </div>
      </section>

      <section>
        <h2>Étapes</h2>
        {m.etapes.length === 0 ? <Vide titre="Aucune étape">Ajoutez des primitives ci-dessous, dans l’ordre d’exécution.</Vide> : (
          <ol className="liste etapes-mission">
            {m.etapes.map((e, i) => {
              const p = primitive(e.primitiveId);
              return (
                <li key={e.id} className="liste-ligne">
                  <span className="etape-num nombre">{i + 1}</span>
                  <div className="etape-corps">
                    <strong>{p?.nom ?? 'Primitive supprimée'}</strong>
                    {p && <div className="discret">{TYPES_PRIMITIVE[p.type].libelle}</div>}
                  </div>
                  {!enCours && (
                    <div className="etape-actions">
                      <button className="bouton-icone" aria-label="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)}><Icone nom="haut" taille={16} /></button>
                      <button className="bouton-icone" aria-label="Descendre" disabled={i === m.etapes.length - 1} onClick={() => deplacer(i, 1)}><Icone nom="bas" taille={16} /></button>
                      <button className="bouton-icone" aria-label="Retirer" onClick={() => maj({ etapes: m.etapes.filter((x) => x.id !== e.id) })}><Icone nom="croix" taille={16} /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {!enCours && (
          <div className="ligne-formulaire">
            <select value={ajout} onChange={(e) => setAjout(e.target.value)} aria-label="Primitive à ajouter">
              <option value="">Ajouter une primitive…</option>
              {primitives.donnee?.map((p) => <option key={p.id} value={p.id}>{TYPES_PRIMITIVE[p.type].libelle} · {p.nom}</option>)}
            </select>
            <button className="bouton" disabled={!ajout} onClick={ajouter}><Icone nom="plus" taille={16} />Ajouter</button>
          </div>
        )}
      </section>

      <div className="pied-assistant">
        {!nouvelle && !enCours && <button className="bouton bouton-discret" onClick={supprimer}>Supprimer</button>}
        <span className="espace" />
        {!enCours && <button className="bouton" disabled={!m.nom.trim()} onClick={enregistrer}>Enregistrer</button>}
        {!enCours && (
          <button className="bouton bouton-primaire" onClick={lancer}
            disabled={!m.nom.trim() || m.etapes.length === 0 || robotChoisi?.etat !== 'disponible'}
            title={robotChoisi && robotChoisi.etat !== 'disponible' ? `${robotChoisi.nom} n’est pas disponible` : undefined}>
            <Icone nom="jouer" taille={16} />Lancer
          </button>
        )}
      </div>
    </>
  );
}
