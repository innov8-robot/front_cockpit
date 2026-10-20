import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ETATS_MISSION, depuis, nbPrimitives } from '../api/libelles';
import { Badge, Chargement, EnTete, Erreur, Icone, Vide } from '../components/ui';
import { useCharge } from '../components/useCharge';

export function Missions() {
  const missions = useCharge(() => api.missions());

  return (
    <>
      <EnTete titre="Missions" sousTitre="Des primitives enchaînées"
        actions={<Link to="/missions/nouvelle" className="bouton bouton-primaire"><Icone nom="plus" taille={16} />Nouvelle mission</Link>} />

      {missions.erreur && <Erreur message={missions.erreur} />}
      {missions.enCours && !missions.donnee ? <Chargement /> : missions.donnee?.length === 0 ? (
        <Vide titre="Aucune mission">Créez une mission en enchaînant des primitives.</Vide>
      ) : (
        <ul className="liste">
          {missions.donnee?.map((m) => (
            <li key={m.id}>
              <Link to={`/missions/${m.id}`} className="liste-ligne liste-lien">
                <div>
                  <strong>{m.nom}</strong>
                  <div className="discret">
                    {nbPrimitives(m)} primitive{nbPrimitives(m) > 1 ? 's' : ''} · ×{m.repetitions} · modifiée {depuis(m.modifieeLe)}
                  </div>
                </div>
                <Badge ton={ETATS_MISSION[m.etat].ton}>{ETATS_MISSION[m.etat].libelle}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
