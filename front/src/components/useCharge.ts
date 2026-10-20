import { useCallback, useEffect, useState } from 'react';

/** Charge une donnée asynchrone ; `recharger` la relit. */
export function useCharge<T>(lire: () => Promise<T>, deps: unknown[] = []) {
  const [donnee, setDonnee] = useState<T | undefined>();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(true);
  const relire = useCallback(lire, deps);

  const recharger = useCallback(() => {
    setEnCours(true);
    relire()
      .then((d) => {
        setDonnee(d);
        setErreur(null);
      })
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : String(e)))
      .finally(() => setEnCours(false));
  }, [relire]);

  useEffect(recharger, [recharger]);
  return { donnee, erreur, enCours, recharger };
}
