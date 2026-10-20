import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, robotUnique } from '../api/client';
import { ANCRAGES, TYPES_PRIMITIVE } from '../api/libelles';
import type { Ancrage, NouvellePrimitive as Brouillon, TypePrimitive } from '../api/types';
import { EnTete, Erreur, Icone } from '../components/ui';
import { useCharge } from '../components/useCharge';

const ETAPES = ['Type', 'Réglages', 'Enregistrement', 'Vérification'];

/** Ce que l'opérateur fait au robot pendant l'enregistrement, selon le type. */
const CONSIGNES: Record<TypePrimitive, string> = {
  prise_objet: 'Placez l’objet devant le robot, puis guidez la pince jusqu’à la prise et fermez-la.',
  prise_boite: 'Placez le bac devant le robot, étiquettes visibles par la caméra de tête.',
  depose: 'Guidez la pince jusqu’à l’endroit de la dépose, puis ouvrez-la.',
  deplacer: 'Amenez le robot au poste, puis confirmez sa position.',
  rentrer: 'Aucun geste à montrer : la garde des bras est celle du robot.',
};

const vide = (): Brouillon => ({
  nom: '', type: 'prise_objet', description: '', objet: null, ancrage: null, poste: null, vitesse: 1, robotId: '',
});

export function NouvellePrimitive() {
  const naviguer = useNavigate();
  const robot = useCharge(robotUnique);
  const [etape, setEtape] = useState(0);
  const [b, setB] = useState<Brouillon>(vide);
  const [enregistrement, setEnregistrement] = useState<'attente' | 'en_cours' | 'fait'>('attente');
  const [erreur, setErreur] = useState<string | null>(null);

  const maj = (champs: Partial<Brouillon>) => setB((x) => ({ ...x, ...champs }));
  const disponible = robot.donnee?.etat === 'disponible';
  useEffect(() => { if (robot.donnee) setB((x) => ({ ...x, robotId: robot.donnee!.id })); }, [robot.donnee]);

  useEffect(() => {
    if (enregistrement !== 'en_cours') return;
    const t = setTimeout(() => setEnregistrement('fait'), 2500);
    return () => clearTimeout(t);
  }, [enregistrement]);

  const reglagesValides =
    b.nom.trim().length > 0 &&
    (b.type !== 'prise_objet' && b.type !== 'prise_boite' || !!b.objet?.trim()) &&
    (b.type !== 'depose' || !!b.ancrage) &&
    (b.type !== 'deplacer' || !!b.poste?.trim());

  const peutContinuer = [true, reglagesValides, disponible && (enregistrement === 'fait' || b.type === 'rentrer'), true][etape];

  async function creer() {
    try {
      await api.creerPrimitive(b);
      naviguer('/primitives');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <Link to="/primitives" className="retour"><Icone nom="retour" taille={16} />Primitives</Link>
      <EnTete titre="Enregistrer une primitive" />

      <ol className="etapes" aria-label="Étapes">
        {ETAPES.map((e, i) => (
          <li key={e} className={i === etape ? 'active' : i < etape ? 'faite' : ''}>
            <span className="etape-num nombre">{i + 1}</span><span className="etape-nom">{e}</span>
          </li>
        ))}
      </ol>

      {erreur && <Erreur message={erreur} />}

      <section className="carte">
        {etape === 0 && (
          <div className="choix-type">
            {(Object.keys(TYPES_PRIMITIVE) as TypePrimitive[]).map((t) => (
              <label key={t} className={`option ${b.type === t ? 'active' : ''}`}>
                <input type="radio" name="type" checked={b.type === t} onChange={() => maj({ type: t })} />
                <strong>{TYPES_PRIMITIVE[t].libelle}</strong>
                <span className="discret">{TYPES_PRIMITIVE[t].aide}</span>
              </label>
            ))}
          </div>
        )}

        {etape === 1 && (
          <div className="formulaire">
            <label>Nom
              <input value={b.nom} onChange={(e) => maj({ nom: e.target.value })} placeholder="Ex. Prendre le capteur A" autoFocus />
            </label>
            <label>Description
              <textarea rows={2} value={b.description} onChange={(e) => maj({ description: e.target.value })} />
            </label>
            {(b.type === 'prise_objet' || b.type === 'prise_boite') && (
              <label>{b.type === 'prise_boite' ? 'Bac' : 'Objet'}
                <input value={b.objet ?? ''} onChange={(e) => maj({ objet: e.target.value })} placeholder="Nom de l’objet" />
              </label>
            )}
            {b.type === 'depose' && (
              <label>Où déposer
                <select value={b.ancrage ?? ''} onChange={(e) => maj({ ancrage: (e.target.value || null) as Ancrage | null })}>
                  <option value="">Choisir…</option>
                  {(Object.keys(ANCRAGES) as Ancrage[]).map((a) => <option key={a} value={a}>{ANCRAGES[a]}</option>)}
                </select>
              </label>
            )}
            {b.type === 'deplacer' && (
              <label>Poste
                <input value={b.poste ?? ''} onChange={(e) => maj({ poste: e.target.value })} placeholder="Ex. table" />
              </label>
            )}
            <label>Vitesse du bras <span className="nombre">×{b.vitesse.toFixed(2)}</span>
              <input type="range" min={0.25} max={2} step={0.25} value={b.vitesse}
                onChange={(e) => maj({ vitesse: Number(e.target.value) })} />
            </label>
          </div>
        )}

        {etape === 2 && (
          <div className="formulaire">
            {robot.donnee && !disponible && <p className="discret">{robot.donnee.nom} n’est pas disponible pour l’instant.</p>}
            <div className="consigne">
              <strong>Au robot</strong>
              <p>{CONSIGNES[b.type]}</p>
            </div>
            {b.type !== 'rentrer' && (
              <div className="enregistrement">
                {enregistrement === 'attente' && (
                  <button className="bouton bouton-primaire" disabled={!disponible} onClick={() => setEnregistrement('en_cours')}>
                    <Icone nom="enregistrer" taille={16} />Démarrer l’enregistrement
                  </button>
                )}
                {enregistrement === 'en_cours' && <p className="pulsation">Enregistrement en cours…</p>}
                {enregistrement === 'fait' && (
                  <p className="texte-ok">Geste enregistré.{' '}
                    <button className="lien" onClick={() => setEnregistrement('attente')}>Recommencer</button>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {etape === 3 && (
          <dl className="faits faits-larges">
            <div><dt>Nom</dt><dd>{b.nom}</dd></div>
            <div><dt>Type</dt><dd>{TYPES_PRIMITIVE[b.type].libelle}</dd></div>
            {b.objet && <div><dt>Objet</dt><dd>{b.objet}</dd></div>}
            {b.ancrage && <div><dt>Dépose</dt><dd>{ANCRAGES[b.ancrage]}</dd></div>}
            {b.poste && <div><dt>Poste</dt><dd>{b.poste}</dd></div>}
            <div><dt>Vitesse</dt><dd className="nombre">×{b.vitesse.toFixed(2)}</dd></div>
            <div><dt>Enregistrée sur</dt><dd>{robot.donnee?.nom}</dd></div>
          </dl>
        )}
      </section>

      <div className="pied-assistant">
        <button className="bouton" disabled={etape === 0} onClick={() => setEtape(etape - 1)}>Précédent</button>
        {etape < ETAPES.length - 1 ? (
          <button className="bouton bouton-primaire" disabled={!peutContinuer} onClick={() => setEtape(etape + 1)}>Suivant</button>
        ) : (
          <button className="bouton bouton-primaire" onClick={creer}>Créer la primitive</button>
        )}
      </div>
    </>
  );
}
