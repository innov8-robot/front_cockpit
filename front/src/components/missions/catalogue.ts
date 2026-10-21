import type { Sortie, Statut } from './charte';

/** Un réglage d'un nœud, tel que le panneau le montre. */
export interface Reglage {
  cle: string;
  libelle: string;
  type: 'nombre' | 'texte' | 'choix' | 'duree' | 'condition' | 'primitive' | 'poste' | 'objet' | 'variable';
  unite?: string;
  options?: string[];
  defaut?: string | number;
  aide?: string;
}

/** Un type de nœud du catalogue. */
export interface TypeNoeud {
  cle: string;
  famille: string;
  nom: string;
  /** La phrase affichée sur le nœud ; `{cle}` y est remplacé par la valeur du réglage, en pastille. */
  phrase: string;
  icone: string;
  sorties: Sortie[];
  /** Un nœud sans entrée ne se trouve qu'en tête : un déclencheur. */
  entree: boolean;
  reglages: Reglage[];
  /** Ce que le nœud laisse aux suivants (le tableau noir de la mission). */
  produit?: string[];
  /** Ce qu'il lui faut avant de pouvoir être joué : l'« exige » du contrat, et ce que demande le robot. */
  prerequis?: string[];
  /** Ses échecs possibles, avec le nom de l'état que le code laisse. */
  issues?: string[];
  statut: Statut;
  /** Ce qui existe déjà au robot, quand le statut n'est pas « à construire ». */
  aujourdhui?: string;
  /** Il fait bouger le robot : marqué sur le canevas, et vérifié avant le lancement. */
  bouge?: boolean;
  /** C'est un cadre : ses étapes sont dedans, comme un bloc en C de Scratch. */
  contient?: boolean;
  aide: string;
}

/** Les icônes du catalogue, au trait (24 × 24). */
export const ICONES: Record<string, string> = {
  eclair: 'M13 2L4 14h7l-1 8 9-12h-7z',
  horloge: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  signal: 'M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12v8',
  prendre: 'M7 4v6a5 5 0 0 0 10 0V4M7 4h3M14 4h3M12 15v5',
  bac: 'M4 9h16v10H4zM8 9V6h8v3M2 12h2M20 12h2',
  deposer: 'M12 4v10M8 10l4 4 4-4M5 20h14',
  rouler: 'M5 12h14M13 6l6 6-6 6',
  rentrer: 'M15 6l-6 6 6 6',
  oeil: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  compter: 'M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10',
  si: 'M6 3v6a3 3 0 0 0 3 3h6M15 8l4 4-4 4M6 21v-6',
  repeter: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  chaque: 'M4 6h16M4 12h16M4 18h10M18 16l2 2-2 2',
  tantque: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  essayer: 'M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4',
  variable: 'M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2M9 12h6',
  plus: 'M12 5v14M5 12h14',
  attendre: 'M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10',
  operateur: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  fin: 'M6 6h12v12H6z',
  sousmission: 'M4 4h7v7H4zM13 13h7v7h-7zM11 7.5h3.5V13',
  note: 'M5 4h14v12l-4 4H5zM15 20v-4h4',
};

/** Les nœuds de logique, de données, de temps, d'opérateur, et les déclencheurs : indépendants du robot. */
export const NOEUDS_GENERAUX: TypeNoeud[] = [
  {
    cle: 'au_lancement', statut: 'existe', famille: 'declencheur', nom: 'Au lancement', phrase: 'Lancement', icone: 'eclair',
    sorties: ['suite'], entree: false, reglages: [], aujourdhui: "le bouton « ▶ Lancer la mission » de l’onglet Exécution",
    aide: 'Le départ : la mission commence quand quelqu’un appuie sur « Lancer ».',
  },
  {
    cle: 'a_heure_fixe', statut: 'nouveau', famille: 'declencheur', nom: 'À heure fixe', phrase: '{heure}', icone: 'horloge',
    sorties: ['suite'], entree: false,
    reglages: [
      { cle: 'jours', libelle: 'Jours', type: 'choix', options: ['jour ouvré', 'jour', 'lundi', 'vendredi'], defaut: 'jour ouvré' },
      { cle: 'heure', libelle: 'Heure', type: 'texte', defaut: '06:30' },
    ],
    aide: 'Planifier une mission : la tournée de 6 h 30, le rangement de fin de poste.',
  },
  {
    cle: 'sur_signal', statut: 'nouveau', famille: 'declencheur', nom: 'Sur signal', phrase: '{signal}', icone: 'signal',
    sorties: ['suite'], entree: false,
    reglages: [{ cle: 'signal', libelle: 'Signal', type: 'choix', options: ['bac plein', 'appel atelier', 'fin de charge'], defaut: 'bac plein' }],
    aide: 'Démarrer sur un évènement extérieur (un capteur, un bouton d’appel, un autre système).',
  },
  {
    cle: 'si', statut: 'nouveau', famille: 'logique', nom: 'Si', phrase: 'Si {condition}', icone: 'si', sorties: ['vrai', 'faux'], entree: true,
    reglages: [{ cle: 'condition', libelle: 'Condition', type: 'condition', defaut: 'pièce restante' }],
    aide: 'Choisir un chemin selon une condition lue sur le robot ou dans la mission.',
  },
  {
    cle: 'repeter', contient: true, statut: 'existe', famille: 'logique', nom: 'Répéter', phrase: 'Répéter {fois}×', icone: 'repeter', sorties: ['corps', 'fini'],
    entree: true, reglages: [{ cle: 'fois', libelle: 'Nombre de tours', type: 'nombre', defaut: 3 }],
    aujourdhui: "la mission entière boucle : un nombre de tours, ou jusqu’au Stop",
    aide: 'Refaire les étapes du cadre un nombre de fois fixé, puis continuer.',
  },
  {
    cle: 'pour_chaque', contient: true, statut: 'nouveau', famille: 'logique', nom: 'Pour chaque', phrase: 'Chaque {objet}', icone: 'chaque',
    sorties: ['corps', 'fini'], entree: true,
    reglages: [{ cle: 'objet', libelle: 'Objet', type: 'objet', defaut: 'pièce Novares' }],
    produit: ['l’objet courant'],
    aide: 'Refaire les étapes du cadre pour chaque objet que le robot voit, le plus proche d’abord.',
  },
  {
    cle: 'tant_que', contient: true, statut: 'atome', famille: 'logique', nom: 'Tant que', phrase: 'Tant que {condition}', icone: 'tantque',
    sorties: ['corps', 'fini'], entree: true,
    reglages: [
      { cle: 'condition', libelle: 'Condition', type: 'condition', defaut: 'bac pas plein' },
      { cle: 'max', libelle: 'Au plus', type: 'nombre', unite: 'tours', defaut: 20, aide: 'Une boucle a toujours une limite.' },
    ],
    aujourdhui: "l’atome repeat de l’arbre (until, max_iter)",
    aide: 'Refaire le cadre tant que la condition tient, jamais plus que la limite.',
  },
  {
    cle: 'essayer', contient: true, statut: 'existe', famille: 'logique', nom: 'Réessayer', phrase: '{fois} essais', icone: 'essayer',
    sorties: ['ok', 'echec'], entree: true,
    reglages: [
      { cle: 'fois', libelle: 'Essais', type: 'nombre', defaut: 2 },
      { cle: 'pause', libelle: 'Entre deux essais', type: 'duree', unite: 's', defaut: 2 },
    ],
    aujourdhui: "un nombre de retentatives pour toute la mission, sur un échec marqué défaisable",
    aide: 'Rejouer le cadre s’il échoue ; « échoué » ne sort qu’après le dernier essai.',
  },
  {
    cle: 'compteur', statut: 'nouveau', famille: 'donnees', nom: 'Compter', phrase: '{variable} +{pas}', icone: 'plus', sorties: ['suite'],
    entree: true,
    reglages: [
      { cle: 'variable', libelle: 'Variable', type: 'variable', defaut: 'déposées' },
      { cle: 'pas', libelle: 'Ajouter', type: 'nombre', defaut: 1 },
    ],
    aide: 'Tenir un compte : les pièces déposées, les échecs, les tours.',
  },
  {
    cle: 'definir', statut: 'nouveau', famille: 'donnees', nom: 'Définir', phrase: '{variable} = {valeur}', icone: 'variable', sorties: ['suite'],
    entree: true,
    reglages: [
      { cle: 'variable', libelle: 'Variable', type: 'variable', defaut: 'bac courant' },
      { cle: 'valeur', libelle: 'Valeur', type: 'texte', defaut: 'B' },
    ],
    aide: 'Donner une valeur à une variable de la mission.',
  },
  {
    cle: 'attendre', statut: 'atome', famille: 'temps', nom: 'Attendre', phrase: '{duree}', icone: 'attendre', sorties: ['suite'], entree: true,
    reglages: [{ cle: 'duree', libelle: 'Durée', type: 'duree', unite: 's', defaut: 5 }],
    aujourdhui: "l’atome wait de l’arbre (seconds)",
    aide: 'Une pause : laisser une machine finir, un opérateur s’écarter.',
  },
  {
    cle: 'attendre_signal', statut: 'nouveau', famille: 'temps', nom: 'Attendre un signal', phrase: '{signal}', icone: 'signal',
    sorties: ['ok', 'echec'], entree: true,
    reglages: [
      { cle: 'signal', libelle: 'Signal', type: 'choix', options: ['presse prête', 'bac vide', 'feu vert'], defaut: 'presse prête' },
      { cle: 'limite', libelle: 'Au plus', type: 'duree', unite: 's', defaut: 120 },
    ],
    aide: 'Attendre un évènement ; « échoué » si la limite passe sans lui.',
  },
  {
    cle: 'demander', statut: 'existe', famille: 'operateur', nom: 'Demander à l’opérateur', phrase: 'Appeler l’opérateur', icone: 'operateur',
    sorties: ['ok', 'echec'], entree: true,
    reglages: [
      { cle: 'message', libelle: 'Message', type: 'texte', defaut: 'Remettez un bac vide' },
      { cle: 'limite', libelle: 'Au plus', type: 'duree', unite: 'min', defaut: 10 },
    ],
    aujourdhui: "les questions posées par les gestes, « Continuer ⏎ » et « ↺ Reprendre »",
    aide: 'Le robot s’arrête et attend un humain : une notification sur la tablette, « fait » ou « abandonner ».',
  },
  {
    cle: 'sous_mission', statut: 'nouveau', famille: 'logique', nom: 'Sous-mission', phrase: '{mission}', icone: 'sousmission',
    sorties: ['ok', 'echec'], entree: true,
    reglages: [{ cle: 'mission', libelle: 'Mission', type: 'choix', options: ['Ranger le poste', 'Recharger'], defaut: 'Ranger le poste' }],
    aide: 'Réutiliser une mission entière comme une seule étape.',
  },
  {
    cle: 'terminer', statut: 'nouveau', famille: 'fin', nom: 'Terminer', phrase: 'Fin {verdict}', icone: 'fin', sorties: [], entree: true,
    reglages: [{ cle: 'verdict', libelle: 'Verdict', type: 'choix', options: ['réussie', 'échouée'], defaut: 'réussie' }],
    aide: 'Finir la mission en disant comment : c’est ce verdict que l’historique retient.',
  },
];

/**
 * Les gestes du robot : les huit types de primitive du cockpit (src/oc_svfp/mission/primitives), avec leur contrat
 * (exige → fournit sur le tableau noir) et les états que le code laisse quand ils échouent.
 */
export const NOEUDS_ROBOT: TypeNoeud[] = [
  {
    cle: 'prise_objet', statut: 'existe', famille: 'robot', nom: 'Prendre un objet', phrase: 'Prendre {primitive}', icone: 'prendre',
    sorties: ['ok', 'echec'], entree: true, bouge: true,
    reglages: [
      { cle: 'primitive', libelle: 'Prise enregistrée', type: 'primitive', defaut: 'pièce Novares', aide: 'Une prise montrée au bras mou, avec la signature de l’objet.' },
      { cle: 'orientation', libelle: 'Orientation', type: 'choix', options: ['suivie', 'ignorée'], defaut: 'suivie' },
      { cle: 'tolerance', libelle: 'Peut tourner de ±', type: 'nombre', unite: '°', defaut: 0, aide: 'De 0 à 90°, essayé par pas de 10°.' },
    ],
    prerequis: ['mains vides (charge = rien)', 'la signature de l’objet, ses vues et une prise montrée', 'la caméra de tête et sa calibration'],
    produit: ['charge = une main', 'bras au-dessus de l’objet', 'la prise tenue (pour la dépose)'],
    issues: ['rien_pris : la pince s’est fermée sans rien', 'pince_fermee : la pince était déjà fermée'],
    aide: 'Un objet pris d’une main, puis soulevé. Le robot retrouve l’objet par sa signature ; il essaie la main de la démo, puis l’autre.',
  },
  {
    cle: 'prise_boite', statut: 'existe', famille: 'robot', nom: 'Prendre une boîte', phrase: 'Prendre {repere}', icone: 'bac',
    sorties: ['ok', 'echec'], entree: true, bouge: true,
    reglages: [
      { cle: 'repere', libelle: 'Boîte', type: 'choix', options: ['boite_novares'], defaut: 'boite_novares', aide: 'Une boîte du registre de la cellule, repérée par ses tags.' },
      { cle: 'geste', libelle: 'Geste', type: 'choix', options: ['colonne', 'donnée'], defaut: 'colonne', aide: '« colonne » : le robot va la chercher ; « donnée » : l’opérateur la pose dans ses mains.' },
    ],
    prerequis: ['mains vides', 'colonne homée (geste colonne)', 'la table vue et les tags de la boîte'],
    produit: ['charge = deux mains', 'boîte tenue', 'hauteur de levée de la colonne'],
    issues: ['rien_serre_avant_survol (réessayable)', 'rien_serre', 'deux_mains_non_verifie', 'tenue_basse'],
    aide: 'Une boîte prise par ses poignées, à deux mains : approche, perception, survol, insertion, serrage, levée.',
  },
  {
    cle: 'depose', statut: 'existe', famille: 'robot', nom: 'Poser la boîte', phrase: 'Poser la boîte', icone: 'deposer',
    sorties: ['ok', 'echec'], entree: true, bouge: true,
    reglages: [
      { cle: 'genre', libelle: 'Où', type: 'choix', options: ['sur place', 'sur un plateau vu'], defaut: 'sur un plateau vu', aide: '« sur un plateau vu » : la zone de dépose enseignée, plateau remesuré au lidar.' },
    ],
    prerequis: ['charge = deux mains', 'la boîte connue (sa pose)', 'colonne homée (plateau vu)'],
    produit: ['charge = rien', 'bras en garde'],
    issues: ['tient_encore', 'pose_non_defourche', 'bras_au_dessus', 'colonne_haute', 'torse_tourne'],
    aide: 'La boîte tenue à deux mains, reposée sur place ou sur un plateau perçu, puis lâchée et dégagée.',
  },
  {
    cle: 'depose_objet', statut: 'existe', famille: 'robot', nom: 'Poser un objet', phrase: 'Poser {primitive}', icone: 'deposer',
    sorties: ['ok', 'echec'], entree: true, bouge: true,
    reglages: [
      { cle: 'primitive', libelle: 'Dépose enregistrée', type: 'primitive', defaut: 'bac B', aide: 'Un endroit montré au bras mou.' },
      { cle: 'ancrage', libelle: 'Par rapport à', type: 'choix', options: ['au robot', 'au tag de table', 'à un objet'], defaut: 'à un objet' },
    ],
    prerequis: ['charge = une main (la prise d’avant)'],
    produit: ['charge = rien', 'bras en garde'],
    issues: ['tient_encore', 'lachee_bras_bloque', 'posee_repli_rate', 'lachee_hors_cible', 'à vérifier : lâchée à plus de 2 cm du point'],
    aide: 'L’objet tenu, posé au point montré, par rapport au robot, au tag de table ou à un objet de référence.',
  },
  {
    cle: 'deplacer', statut: 'existe', famille: 'deplacement', nom: 'Aller à un poste', phrase: 'Aller {poste}', icone: 'rouler',
    sorties: ['ok', 'echec'], entree: true, bouge: true,
    reglages: [{ cle: 'poste', libelle: 'Poste', type: 'poste', options: ['table', 'étagère', 'base', 'bac B'], defaut: 'table', aide: 'Un poste de la carte du châssis.' }],
    prerequis: ['bras dans une posture connue', 'châssis localisé sur la carte du poste'],
    produit: ['au poste', 'base déplacée (re-percevoir avant de prendre)'],
    issues: ['en_route : le trajet a échoué'],
    aide: 'La base roule jusqu’au poste : 0,5 m/s à vide, 0,25 puis 0,08 m/s en portant une boîte.',
  },
  {
    cle: 'tourner_base', statut: 'existe', famille: 'deplacement', nom: 'Tourner sur place', phrase: 'Pivoter {angle}', icone: 'repeter',
    sorties: ['ok', 'echec'], entree: true, bouge: true,
    reglages: [{ cle: 'angle', libelle: 'Angle', type: 'nombre', unite: '°', defaut: 180, aide: 'Entre −360 et 360, positif vers la gauche.' }],
    prerequis: ['bras dans une posture connue'], produit: ['base déplacée'], issues: ['en_route'],
    aide: 'La base pivote sur place.',
  },
  {
    cle: 'tourner_buste', statut: 'existe', famille: 'deplacement', nom: 'Tourner le buste', phrase: 'Buste {lacet}', icone: 'rentrer',
    sorties: ['ok', 'echec'], entree: true, bouge: true,
    reglages: [{ cle: 'lacet', libelle: 'Lacet', type: 'nombre', unite: '°', defaut: 90, aide: 'Absolu, de −155 à 155 (0 = face avant).' }],
    prerequis: ['bras dans une posture connue'], issues: ['buste_bloque (réessayable)', 'piece_perdue'],
    aide: 'Le buste tourne à un angle donné, en vérifiant le balayage contre le décor.',
  },
  {
    cle: 'rentrer', statut: 'existe', famille: 'deplacement', nom: 'Rentrer les bras', phrase: 'Rentrer les bras', icone: 'rentrer',
    sorties: ['ok', 'echec'], entree: true, bouge: true, reglages: [],
    prerequis: ['mains vides'], produit: ['bras au repos'], issues: ['bras_en_l_air'],
    aide: 'Les bras reviennent au repos par un chemin planifié. Seulement mains vides.',
  },
  {
    cle: 'voir', statut: 'atome', famille: 'perception', nom: 'Voir', phrase: '{objet} vu ?', icone: 'oeil',
    sorties: ['vrai', 'faux'], entree: true,
    reglages: [{ cle: 'objet', libelle: 'Objet', type: 'objet', defaut: 'pièce Novares', aide: 'Un objet dont on a la signature.' }],
    aujourdhui: 'les atomes perceive et perceive_fixe, sous une prise',
    aide: 'Regarder sans bouger : oui si l’objet est vu, non sinon.',
  },
  {
    cle: 'compter', statut: 'nouveau', famille: 'perception', nom: 'Compter', phrase: 'Compter {objet}', icone: 'compter',
    sorties: ['suite'], entree: true,
    reglages: [
      { cle: 'objet', libelle: 'Objet', type: 'objet', defaut: 'pièce Novares' },
      { cle: 'variable', libelle: 'Ranger dans', type: 'variable', defaut: 'pièces restantes' },
    ],
    produit: ['le nombre d’objets vus'],
    aide: 'Compter les objets visibles et ranger le nombre dans une variable : « tant que pièces restantes > 0 ».',
  },
  {
    cle: 'selon_issue', statut: 'nouveau', famille: 'logique', nom: 'Selon l’échec', phrase: 'Selon l’échec', icone: 'si',
    sorties: ['cas1', 'cas2', 'autre'], entree: true,
    reglages: [
      { cle: 'etape', libelle: 'Étape', type: 'texte', defaut: 'la prise' },
      { cle: 'cas1', libelle: 'Cas 1', type: 'choix', options: ['rien_pris', 'pince_fermee', 'tient_encore'], defaut: 'rien_pris' },
      { cle: 'cas2', libelle: 'Cas 2', type: 'choix', options: ['pince_fermee', 'rien_pris', 'tient_encore'], defaut: 'pince_fermee' },
    ],
    aide: 'Le Switch de n8n : un chemin par motif d’échec (rien pris → réessayer ; pince fermée → appeler l’opérateur).',
  },
];

/** Tout le catalogue, dans l'ordre de la palette. */
export const CATALOGUE: TypeNoeud[] = [...NOEUDS_GENERAUX, ...NOEUDS_ROBOT];

/** Le type de nœud d'une clé du catalogue. */
export function typeNoeud(cle: string): TypeNoeud {
  const t = CATALOGUE.find((x) => x.cle === cle);
  if (!t) throw new Error(`nœud inconnu : ${cle}`);
  return t;
}
