import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ANCRAGES, TYPES_PRIMITIVE, depuis } from '../api/libelles';
import type { Primitive, TypePrimitive } from '../api/types';
import { Badge, Chargement, EnTete, Erreur, Icone, Vide } from '../components/ui';
import { useCharge } from '../components/useCharge';

function detail(p: Primitive): string {
  if (p.objet) return p.objet;
  if (p.ancrage) return ANCRAGES[p.ancrage];
  if (p.poste) return `Poste « ${p.poste} »`;
  return '';
}

export function Primitives() {
  const primitives = useCharge(() => api.primitives());
  const [type, setType] = useState<TypePrimitive | 'tous'>('tous');
  const [recherche, setRecherche] = useState('');

  const visibles = primitives.donnee?.filter(
    (p) => (type === 'tous' || p.type === type) && p.nom.toLowerCase().includes(recherche.toLowerCase()),
  ) ?? [];

  async function supprimer(p: Primitive) {
    if (!confirm(`Supprimer « ${p.nom} » ?`)) return;
    await api.supprimerPrimitive(p.id);
    primitives.recharger();
  }

  return (
    <>
      <EnTete titre="Primitives" sousTitre="Les gestes que vos robots savent faire"
        actions={<Link to="/primitives/nouvelle" className="bouton bouton-primaire"><Icone nom="plus" taille={16} />Enregistrer</Link>} />

      <div className="filtres">
        <input type="search" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <div className="puces" role="group" aria-label="Type">
          <button className={`puce ${type === 'tous' ? 'active' : ''}`} onClick={() => setType('tous')}>Toutes</button>
          {(Object.keys(TYPES_PRIMITIVE) as TypePrimitive[]).map((t) => (
            <button key={t} className={`puce ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>
              {TYPES_PRIMITIVE[t].libelle}
            </button>
          ))}
        </div>
      </div>

      {primitives.erreur && <Erreur message={primitives.erreur} />}
      {primitives.enCours && !primitives.donnee ? <Chargement /> : visibles.length === 0 ? (
        <Vide titre="Aucune primitive">Enregistrez un premier geste avec le bouton « Enregistrer ».</Vide>
      ) : (
        <ul className="grille-cartes">
          {visibles.map((p) => (
            <li key={p.id} className="carte">
              <div className="carte-ligne">
                <Badge ton="neutre">{TYPES_PRIMITIVE[p.type].libelle}</Badge>
                <button className="bouton-icone" aria-label={`Supprimer ${p.nom}`} onClick={() => supprimer(p)}>
                  <Icone nom="croix" taille={16} />
                </button>
              </div>
              <strong>{p.nom}</strong>
              <p className="discret">{p.description}</p>
              <dl className="faits">
                {detail(p) && <div><dt>Cible</dt><dd>{detail(p)}</dd></div>}
                <div><dt>Réussite</dt><dd className="nombre">{p.tauxReussite === null ? '—' : `${Math.round(p.tauxReussite * 100)} %`}</dd></div>
                <div><dt>Exécutions</dt><dd className="nombre">{p.executions}</dd></div>
                <div><dt>Créée</dt><dd>{depuis(p.creeLe)} · {p.creePar}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
