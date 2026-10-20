import type { Ancrage, EtatMission, EtatRobot, IssueRun, TypePrimitive } from './types';

export const ETATS_ROBOT: Record<EtatRobot, { libelle: string; ton: Ton }> = {
  disponible: { libelle: 'Disponible', ton: 'ok' },
  en_mission: { libelle: 'En mission', ton: 'info' },
  en_charge: { libelle: 'En charge', ton: 'neutre' },
  hors_ligne: { libelle: 'Hors ligne', ton: 'neutre' },
  arret_urgence: { libelle: 'Arrêt d’urgence', ton: 'danger' },
};

export const TYPES_PRIMITIVE: Record<TypePrimitive, { libelle: string; aide: string }> = {
  prise_objet: { libelle: 'Prise d’objet', aide: 'Montrez une prise une fois au bras ; le robot retrouve l’objet et la rejoue.' },
  prise_boite: { libelle: 'Prise de bac', aide: 'Saisie à deux mains par les poignées d’un bac repéré.' },
  depose: { libelle: 'Dépose', aide: 'Pose ce que le robot tient, par rapport au robot, à un objet ou à un bac.' },
  deplacer: { libelle: 'Déplacement', aide: 'La base roule jusqu’à un poste nommé de la carte.' },
  rentrer: { libelle: 'Rentrer', aide: 'Ramène les bras en garde avant de rouler.' },
};

export const ANCRAGES: Record<Ancrage, string> = {
  robot: 'Par rapport au robot',
  objet: 'Par rapport à un objet',
  boite: 'Dans un bac repéré',
  plan_percu: 'Sur la surface vue',
};

export const ETATS_MISSION: Record<EtatMission, { libelle: string; ton: Ton }> = {
  brouillon: { libelle: 'Brouillon', ton: 'neutre' },
  prete: { libelle: 'Prête', ton: 'ok' },
  en_cours: { libelle: 'En cours', ton: 'info' },
  terminee: { libelle: 'Terminée', ton: 'ok' },
  echouee: { libelle: 'Échouée', ton: 'danger' },
};

export const ISSUES_RUN: Record<IssueRun, { libelle: string; ton: Ton }> = {
  reussi: { libelle: 'Réussi', ton: 'ok' },
  echoue: { libelle: 'Échoué', ton: 'danger' },
  interrompu: { libelle: 'Interrompu', ton: 'alerte' },
};

export type Ton = 'ok' | 'info' | 'alerte' | 'danger' | 'neutre';

export function depuis(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

/** Le nombre de primitives d'une mission (le départ n'en est pas une). */
export function nbPrimitives(m: { noeuds: { primitiveId: string | null }[] }): number {
  return m.noeuds.filter((n) => n.primitiveId).length;
}
