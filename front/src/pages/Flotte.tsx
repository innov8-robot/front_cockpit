import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ETATS_ROBOT, depuis } from '../api/libelles';
import type { EtatRobot } from '../api/types';
import { Badge, Batterie, Chargement, EnTete, Erreur, Vide } from '../components/ui';
import { useCharge } from '../components/useCharge';

export function Flotte() {
  const robots = useCharge(() => api.robots());
  const missions = useCharge(() => api.missions());
  const [filtre, setFiltre] = useState<EtatRobot | 'tous'>('tous');

  const nomMission = useMemo(() => {
    const m = new Map(missions.donnee?.map((x) => [x.id, x.nom]));
    return (id: string | null) => (id ? m.get(id) ?? '—' : null);
  }, [missions.donnee]);

  const comptes = useMemo(() => {
    const c: Partial<Record<EtatRobot, number>> = {};
    robots.donnee?.forEach((r) => (c[r.etat] = (c[r.etat] ?? 0) + 1));
    return c;
  }, [robots.donnee]);

  const visibles = robots.donnee?.filter((r) => filtre === 'tous' || r.etat === filtre) ?? [];

  return (
    <>
      <EnTete titre="Flotte" sousTitre={robots.donnee ? `${robots.donnee.length} robots` : undefined} />

      <div className="tuiles">
        {(['disponible', 'en_mission', 'en_charge', 'hors_ligne'] as EtatRobot[]).map((e) => (
          <button key={e} className={`tuile ${filtre === e ? 'active' : ''}`}
            onClick={() => setFiltre(filtre === e ? 'tous' : e)}>
            <span className="tuile-valeur nombre">{comptes[e] ?? 0}</span>
            <span className="tuile-libelle">{ETATS_ROBOT[e].libelle}</span>
          </button>
        ))}
      </div>

      {robots.erreur && <Erreur message={robots.erreur} />}
      {robots.enCours && !robots.donnee ? <Chargement /> : visibles.length === 0 ? (
        <Vide titre="Aucun robot dans cet état" />
      ) : (
        <ul className="grille-cartes">
          {visibles.map((r) => (
            <li key={r.id}>
              <Link to={`/flotte/${r.id}`} className="carte carte-lien">
                <div className="carte-ligne">
                  <strong>{r.nom}</strong>
                  <Badge ton={ETATS_ROBOT[r.etat].ton}>{ETATS_ROBOT[r.etat].libelle}</Badge>
                </div>
                <div className="discret">{r.modele} · {r.site}</div>
                <dl className="faits">
                  <div><dt>Batterie</dt><dd><Batterie niveau={r.batterie} /></dd></div>
                  <div><dt>Poste</dt><dd>{r.posteCourant ?? '—'}</dd></div>
                  <div><dt>Mission</dt><dd>{nomMission(r.missionCourante) ?? 'Aucune'}</dd></div>
                  <div><dt>Vu</dt><dd>{depuis(r.derniereConnexion)}</dd></div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
