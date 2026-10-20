import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ETATS_ROBOT, ISSUES_RUN, depuis, nbPrimitives } from '../api/libelles';
import { Badge, Batterie, Chargement, EnTete, Erreur, Icone, Vide } from '../components/ui';
import { useCharge } from '../components/useCharge';

export function RobotDetail() {
  const { id = '' } = useParams();
  const robot = useCharge(() => api.robot(id), [id]);
  const runs = useCharge(() => api.runs({ robotId: id }), [id]);
  const missions = useCharge(() => api.missions());
  const [missionChoisie, setMissionChoisie] = useState('');
  const [message, setMessage] = useState<{ ton: 'ok' | 'danger'; texte: string } | null>(null);

  if (robot.enCours && !robot.donnee) return <Chargement />;
  const r = robot.donnee;
  if (!r) return <Vide titre="Robot introuvable"><Link to="/flotte">Retour à la flotte</Link></Vide>;

  const nomMission = (mid: string) => missions.donnee?.find((m) => m.id === mid)?.nom ?? '—';
  const etat = ETATS_ROBOT[r.etat];

  async function arreter() {
    if (!confirm(`Arrêt d’urgence de ${r!.nom} ?`)) return;
    await api.arretUrgence(r!.id);
    robot.recharger();
  }

  async function lancer() {
    try {
      await api.lancerMission(missionChoisie, r!.id);
      setMessage({ ton: 'ok', texte: 'Mission lancée.' });
      robot.recharger();
      runs.recharger();
    } catch (e) {
      setMessage({ ton: 'danger', texte: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <>
      <Link to="/flotte" className="retour"><Icone nom="retour" taille={16} />Flotte</Link>
      <EnTete titre={r.nom} sousTitre={`${r.modele} · ${r.site}`}
        actions={r.etat !== 'hors_ligne' && (
          <button className="bouton bouton-danger" onClick={arreter} disabled={r.etat === 'arret_urgence'}>
            <Icone nom="stop" taille={16} />Arrêt d’urgence
          </button>
        )} />

      {robot.erreur && <Erreur message={robot.erreur} />}
      {message && <div className={`alerte alerte-${message.ton}`}>{message.texte}</div>}

      <section className="carte">
        <dl className="faits faits-larges">
          <div><dt>État</dt><dd><Badge ton={etat.ton}>{etat.libelle}</Badge></dd></div>
          <div><dt>Batterie</dt><dd><Batterie niveau={r.batterie} /></dd></div>
          <div><dt>Poste</dt><dd>{r.posteCourant ?? '—'}</dd></div>
          <div><dt>Dernière connexion</dt><dd>{depuis(r.derniereConnexion)}</dd></div>
          <div><dt>Mission en cours</dt><dd>{r.missionCourante ? nomMission(r.missionCourante) : 'Aucune'}</dd></div>
        </dl>
      </section>

      {r.etat === 'disponible' && (
        <section className="carte">
          <h2>Lancer une mission</h2>
          <div className="ligne-formulaire">
            <select value={missionChoisie} onChange={(e) => setMissionChoisie(e.target.value)} aria-label="Mission">
              <option value="">Choisir une mission…</option>
              {missions.donnee?.filter((m) => nbPrimitives(m) > 0).map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
            <button className="bouton bouton-primaire" disabled={!missionChoisie} onClick={lancer}>
              <Icone nom="jouer" taille={16} />Lancer
            </button>
          </div>
        </section>
      )}

      <section>
        <h2>Historique</h2>
        {runs.donnee && runs.donnee.length === 0 ? <Vide titre="Aucune exécution" /> : (
          <ul className="liste">
            {runs.donnee?.map((u) => (
              <li key={u.id} className="liste-ligne">
                <div>
                  <strong>{nomMission(u.missionId)}</strong>
                  <div className="discret">{depuis(u.debut)} · {u.dureeS} s{u.cause ? ` · ${u.cause}` : ''}</div>
                </div>
                <Badge ton={ISSUES_RUN[u.issue].ton}>{ISSUES_RUN[u.issue].libelle}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
