/** Le contenu rédigé de la proposition d'éditeur de missions (#/essai/missions) : personas, histoires, exigences. */

/** `en_tant` : la tournure de l'histoire, avec son élision (« qu'opératrice », « que technicien »). */
export interface Persona { cle: string; nom: string; role: string; en_tant: string; sait: string; veut: string }

export const PERSONAS: Persona[] = [
  {
    cle: 'operateur', nom: 'Clara', role: 'Opératrice de cellule', en_tant: 'qu’opératrice de cellule',
    sait: 'son poste, ses pièces, ses cadences ; ne programme pas',
    veut: 'lancer la bonne mission, savoir où elle en est, repartir vite après un arrêt',
  },
  {
    cle: 'methodes', nom: 'Hugo', role: 'Technicien méthodes', en_tant: 'que technicien méthodes',
    sait: 'le procédé et ses aléas ; a déjà fait un peu de Scratch ou d’automates',
    veut: 'assembler une mission à partir des gestes enregistrés, avec ses conditions et ses reprises',
  },
  {
    cle: 'roboticien', nom: 'Thomas & Bilal', role: 'Roboticiens Innov8', en_tant: 'que roboticien',
    sait: 'le robot, les primitives, le code',
    veut: 'voir ce qui passe d’une étape à l’autre, comprendre un échec, ajouter un type de geste',
  },
  {
    cle: 'chef', nom: 'Nadia', role: 'Cheffe d’atelier', en_tant: 'que cheffe d’atelier',
    sait: 'la production, les équipes',
    veut: 'planifier les tournées, suivre le taux de réussite, savoir qui a changé quoi',
  },
];

export interface Histoire { id: string; persona: string; je_veux: string; afin_de: string; criteres: string[]; priorite: 'Doit' | 'Devrait' | 'Pourrait' }

export const HISTOIRES: Histoire[] = [
  {
    id: 'H1', persona: 'operateur', je_veux: 'lancer une mission prête depuis l’accueil, en un geste', afin_de: 'ne pas ouvrir l’éditeur pour travailler',
    criteres: ['Seules les missions valides sont proposées', 'Un robot indisponible ne lance rien et dit pourquoi', 'Le lancement demande une confirmation si la mission fait bouger le robot'],
    priorite: 'Doit',
  },
  {
    id: 'H2', persona: 'operateur', je_veux: 'voir la mission avancer étape par étape', afin_de: 'savoir où en est le robot sans lire de journal',
    criteres: ['Le nœud en cours est mis en évidence (couleur et icône)', 'Les étapes faites sont cochées, les non jouées grisées', 'Le chrono et le tour de boucle sont visibles'],
    priorite: 'Doit',
  },
  {
    id: 'H3', persona: 'operateur', je_veux: 'mettre en pause, reprendre ou arrêter', afin_de: 'intervenir dans la cellule sans tout perdre',
    criteres: ['La pause attend la fin du geste en cours, jamais au milieu d’un mouvement (le robot lit déjà le Stop entre deux primitives)', 'L’E-STOP reste dans la barre du robot, hors de l’éditeur', 'Après un arrêt, « reprendre ici » propose l’étape interrompue — aujourd’hui « Relancer » repart du début'],
    priorite: 'Doit',
  },
  {
    id: 'H4', persona: 'operateur', je_veux: 'être appelée quand le robot a besoin de moi', afin_de: 'ne pas surveiller l’écran en permanence',
    criteres: ['Un nœud « Demander à l’opérateur » envoie une notification sur la tablette', 'Deux réponses : « fait » ou « abandonner »', 'Sans réponse dans le délai, la mission suit la sortie « échoué »'],
    priorite: 'Devrait',
  },
  {
    id: 'H5', persona: 'methodes', je_veux: 'composer une mission en glissant des gestes enregistrés sur un canevas', afin_de: 'ne pas dépendre d’un roboticien pour chaque variante',
    criteres: ['La palette range les nœuds par famille, avec une recherche', 'Glisser ou cliquer « + » au bout d’une sortie ajoute un nœud déjà relié', 'Annuler / rétablir, copier / coller, aligner'],
    priorite: 'Doit',
  },
  {
    id: 'H6', persona: 'methodes', je_veux: 'ajouter des conditions et des boucles sans écrire de code', afin_de: 'traiter « tant qu’il reste des pièces », « si la prise échoue, réessaie »',
    criteres: ['Si, Pour, Pour chaque, Tant que, Répéter, Attendre, Compter', 'Une boucle sort par « faire » à chaque tour et par « fini » à la fin ; le tour revient dans son entrée (le Loop Over Items de n8n)', 'Toute boucle a une limite de tours'],
    priorite: 'Doit',
  },
  {
    id: 'H7', persona: 'methodes', je_veux: 'régler une étape dans un panneau clair', afin_de: 'savoir ce qu’elle attend et ce qu’elle produit',
    criteres: ['Trois colonnes : ce qui arrive, les réglages, ce qui sort', 'Chaque réglage a une valeur par défaut et une aide', 'Un réglage invalide est signalé sur le nœud'],
    priorite: 'Doit',
  },
  {
    id: 'H8', persona: 'methodes', je_veux: 'que la mission soit vérifiée avant de la lancer', afin_de: 'ne pas découvrir l’erreur au robot',
    criteres: ['Nœud non relié, réglage manquant, geste dont le prérequis manque (signature, poste, colonne homée)', 'Le contrat de chaque lien : ce que l’étape exige doit être fourni par celles d’avant (déposer sans rien tenir, rentrer les mains pleines, finir mains pleines) — la vérification « flèches » du cockpit, sur un graphe', 'Les erreurs bloquent le lancement ; les avertissements non'],
    priorite: 'Doit',
  },
  {
    id: 'H9', persona: 'methodes', je_veux: 'jouer la mission en simulation avant le robot', afin_de: 'tester sans risque',
    criteres: ['Même graphe, même affichage d’exécution', 'Le mode simulé est écrit en grand', 'On peut forcer l’issue d’un nœud (réussi / échoué) pour tester une branche'],
    priorite: 'Devrait',
  },
  {
    id: 'H10', persona: 'roboticien', je_veux: 'voir ce que chaque étape a reçu et produit', afin_de: 'comprendre un échec',
    criteres: ['Le panneau d’une étape jouée montre ses entrées, sa sortie, sa durée, son motif d’échec', 'L’historique garde chaque exécution, rejouable à l’écran', 'Le verdict vient du robot (mesure), jamais d’une supposition'],
    priorite: 'Doit',
  },
  {
    id: 'H11', persona: 'roboticien', je_veux: 'ajouter un type de nœud sans toucher l’éditeur', afin_de: 'suivre les nouveaux gestes du robot',
    criteres: ['Un type de nœud = une entrée de catalogue (famille, phrase, réglages, sorties)', 'Le back sert le catalogue des primitives disponibles'],
    priorite: 'Devrait',
  },
  {
    id: 'H12', persona: 'chef', je_veux: 'planifier une mission à heure fixe ou sur un signal', afin_de: 'automatiser les tournées',
    criteres: ['Déclencheurs « À heure fixe » et « Sur signal »', 'Une mission planifiée ne part pas si le robot est occupé : elle est mise en file et le dit'],
    priorite: 'Pourrait',
  },
  {
    id: 'H13', persona: 'chef', je_veux: 'savoir qui a modifié une mission et revenir en arrière', afin_de: 'garder la main sur la production',
    criteres: ['Brouillon / publiée : seule une mission publiée se lance en production', 'Chaque publication est une version, avec son auteur et sa date'],
    priorite: 'Devrait',
  },
];

export interface Exigence { id: string; groupe: string; texte: string; priorite: 'Doit' | 'Devrait' | 'Pourrait' }

export const EXIGENCES: Exigence[] = [
  { id: 'F1', groupe: 'Édition', priorite: 'Doit', texte: 'Canevas infini : déplacer, zoomer, mini-carte, aligner automatiquement.' },
  { id: 'F2', groupe: 'Édition', priorite: 'Doit', texte: 'Ajouter un nœud par la palette (familles + recherche) ou par « + » au bout d’une sortie, déjà relié.' },
  { id: 'F3', groupe: 'Édition', priorite: 'Doit', texte: 'Sorties nommées : réussi / échoué, oui / non, à chaque tour / ensuite. Une sortie non reliée termine la branche.' },
  { id: 'F4', groupe: 'Édition', priorite: 'Doit', texte: 'Boucles et conditions en nœuds à sorties nommées (alors / sinon, faire / fini) ; une boucle neuve arrive avec sa case à remplir.' },
  { id: 'F5', groupe: 'Édition', priorite: 'Devrait', texte: 'Annuler / rétablir, copier / coller, dupliquer, désactiver un nœud, notes sur le canevas.' },
  { id: 'F6', groupe: 'Réglages', priorite: 'Doit', texte: 'Panneau de nœud à trois colonnes : entrées (tableau noir), réglages, sorties ; aide sur chaque réglage.' },
  { id: 'F7', groupe: 'Réglages', priorite: 'Doit', texte: 'Conditions composées de menus (pas de texte libre) : objet, capteur, variable, comparaison, valeur.' },
  { id: 'F8', groupe: 'Vérification', priorite: 'Doit', texte: 'Vérification continue, affichée sur les nœuds ; erreurs bloquantes et avertissements distincts.' },
  { id: 'F9', groupe: 'Exécution', priorite: 'Doit', texte: 'Lancer, pause (à la fin du geste), reprendre, arrêter ; état de chaque nœud en direct.' },
  { id: 'F10', groupe: 'Exécution', priorite: 'Devrait', texte: 'Pas-à-pas : jouer un seul nœud ; forcer une issue en simulation.' },
  { id: 'F11', groupe: 'Historique', priorite: 'Doit', texte: 'Chaque exécution enregistrée : chemin suivi, durée et verdict par nœud, motif d’échec.' },
  { id: 'F12', groupe: 'Versions', priorite: 'Devrait', texte: 'Brouillon / publiée, versions datées et signées, retour à une version.' },
  { id: 'F13', groupe: 'Déclencheurs', priorite: 'Pourrait', texte: 'Lancement manuel, à heure fixe, sur signal ; file d’attente quand le robot est occupé.' },
  { id: 'N1', groupe: 'Plateformes', priorite: 'Doit', texte: 'Web et tablette Android (Capacitor) ; tactile d’abord : cibles de 44 px, glisser au doigt.' },
  { id: 'N2', groupe: 'Lisibilité', priorite: 'Doit', texte: 'Jamais la couleur seule : forme, icône et libellé disent aussi la famille et l’état.' },
  { id: 'N3', groupe: 'Performance', priorite: 'Devrait', texte: '150 nœuds fluides ; état d’exécution rafraîchi à 1 Hz au moins.' },
  { id: 'N4', groupe: 'Format', priorite: 'Doit', texte: 'Mission en JSON versionné, traduisible vers le format que joue le robot (primitives et arbre de comportement).' },
  { id: 'S1', groupe: 'Sécurité', priorite: 'Doit', texte: 'L’E-STOP reste dans la barre du robot, visible dans l’éditeur ; aucune action de l’éditeur ne le masque.' },
  { id: 'S2', groupe: 'Sécurité', priorite: 'Doit', texte: 'Les nœuds qui font bouger le robot sont marqués ; un enchaînement que le contrat refuse (rouler bras en posture inconnue, rentrer les mains pleines) bloque le lancement.' },
  { id: 'S3', groupe: 'Sécurité', priorite: 'Doit', texte: 'Le verdict d’une étape vient du robot (mesure) ; l’éditeur n’affirme jamais une réussite non mesurée.' },
  { id: 'S4', groupe: 'Sécurité', priorite: 'Doit', texte: 'Toute boucle et toute attente ont une limite ; dépassée, elles sortent par « échoué ».' },
];

export interface Principe { source: 'n8n' | 'Scratch'; idee: string; chez_nous: string }

export const PRINCIPES: Principe[] = [
  { source: 'n8n', idee: 'Un nœud = une étape, reliée aux suivantes ; un déclencheur en tête, marqué d’un éclair.', chez_nous: 'Le canevas de la mission, ses déclencheurs (lancement, heure, signal).' },
  { source: 'n8n', idee: 'Le panneau de nœud : ce qui arrive à gauche, les réglages au centre, ce qui sort à droite.', chez_nous: 'Le panneau à trois colonnes, avec le tableau noir de la mission (l’objet pris, le côté…).' },
  { source: 'n8n', idee: 'IF (vrai / faux), Switch, Merge, Loop Over Items (boucle / fini), Wait, sous-workflows.', chez_nous: 'Si, Pour chaque, Répéter, Tant que, Attendre, Sous-mission.' },
  { source: 'n8n', idee: 'Réglages d’erreur par nœud : Retry On Fail, On Error (arrêter, continuer, sortie d’erreur).', chez_nous: 'Un geste a un paramètre « essais » et un « si ça rate » : arrêter la mission, ou ouvrir sa sortie « échec ».' },
  { source: 'n8n', idee: 'Les exécutions : chaque run, son statut, ses données à chaque nœud.', chez_nous: 'L’historique rejouable à l’écran, verdict par nœud.' },
  { source: 'Scratch', idee: 'La catégorie se lit à la couleur, le rôle à la forme : chapeau, pile, bloc en C, booléen hexagonal.', chez_nous: 'Familles colorées (l’icône de la tuile) ; un déclencheur a le bord gauche arrondi, une fin le bord droit.' },
  { source: 'Scratch', idee: 'Les blocs se lisent comme des phrases avec des trous à remplir.', chez_nous: '« Répéter [3] fois », « Si [il reste une pièce] » : pas de syntaxe.' },
  { source: 'n8n', idee: 'Loop Over Items : une sortie « loop » vers le corps, une sortie « done » pour la suite ; le corps revient dans l’entrée.', chez_nous: 'Pour, pour chaque, tant que, répéter : sorties « faire » et « fini », le retour passe sous les nœuds.' },
];

/** Ce que le relevé du cockpit réel (mpc_dev) a trouvé : les primitives et l'état des missions. */
export const EXISTANT = {
  primitives: [
    { cle: 'prise_objet', nom: 'Prendre un objet', fait: 'Prise d’une main montrée au bras mou, objet retrouvé par sa signature DINOv2, puis soulevé.', reglages: 'prise enregistrée (vues + prise), orientation suivie / ignorée, tolérance de lacet 0–90°', issues: 'rien_pris, pince_fermee', prerequis: 'mains vides ; signature ; caméra' },
    { cle: 'prise_boite', nom: 'Prendre une boîte', fait: 'Boîte du registre prise par ses poignées à deux mains (« colonne ») ou posée dans les mains (« donnée »).', reglages: 'repère de la boîte, geste, posture, correction des mains', issues: 'rien_serre_avant_survol*, rien_serre, deux_mains_non_verifie, tenue_basse', prerequis: 'mains vides ; colonne homée ; tags et table vus' },
    { cle: 'depose', nom: 'Poser la boîte', fait: 'Boîte reposée sur place ou sur un plateau perçu (zone de dépose enseignée), lâchée, dégagée.', reglages: 'genre sur place / plan perçu, plateau, poste', issues: 'tient_encore, pose_non_defourche, bras_au_dessus, colonne_haute, torse_tourne', prerequis: 'deux mains ; boîte connue ; colonne homée' },
    { cle: 'depose_objet', nom: 'Poser un objet', fait: 'Objet posé au point montré, par rapport au robot, au tag ou à un objet.', reglages: 'ancrage robot / tag / objet, pose, côté, colonne', issues: 'tient_encore, lachee_bras_bloque, posee_repli_rate, lachee_hors_cible, « à vérifier »', prerequis: 'une main' },
    { cle: 'deplacer', nom: 'Aller à un poste', fait: 'La base roule jusqu’à un poste de la carte ; plus lente en portant.', reglages: 'poste', issues: 'en_route', prerequis: 'bras en posture connue ; châssis localisé' },
    { cle: 'tourner_base', nom: 'Tourner sur place', fait: 'La base pivote d’un angle relatif.', reglages: 'angle (0 < |a| ≤ 360°)', issues: 'en_route', prerequis: 'bras en posture connue' },
    { cle: 'tourner_buste', nom: 'Tourner le buste', fait: 'Le buste tourne à un lacet absolu.', reglages: 'lacet (±155°)', issues: 'buste_bloque*, piece_perdue', prerequis: 'bras en posture connue' },
    { cle: 'rentrer', nom: 'Rentrer les bras', fait: 'Bras au repos par un chemin planifié.', reglages: '—', issues: 'bras_en_l_air', prerequis: 'mains vides' },
  ],
  constats: [
    'Chaque primitive a un contrat : ce qu’elle exige et ce qu’elle fournit sur un tableau noir de six faits (charge, boîte tenue, bras, poste, base déplacée, hauteur de colonne). * = échec que le robot sait réessayer.',
    'Une mission est aujourd’hui une liste ordonnée de primitives : pas de branche, pas de condition. Les retentatives et la boucle (N tours ou jusqu’au Stop) valent pour toute la mission ; « vide » (jusqu’à ce qu’il n’y ait plus de pièce) est refusé.',
    'Le cockpit vérifie déjà les « flèches » : chaque étape doit recevoir ce qu’elle exige ; une mission sans boucle ne peut pas finir mains pleines. L’éditeur reprend cette vérification, sur un graphe.',
    'La logique (séquence, repli, répéter, parallèle, attendre) existe un étage plus bas, dans les atomes de l’arbre de comportement — pas au niveau des missions.',
    'Pas de vraie pause : un Stop entre deux primitives, des questions « Continuer ⏎ » posées par les gestes ; après un échec, « Relancer » repart du début.',
    'L’écran Mission enregistre une mission « en la faisant » (« Jouer puis ajouter ») : c’est un atout à garder à côté du canevas.',
  ],
};

/** Ce qu'il reste à trancher avant de construire. */
export const QUESTIONS: string[] = [
  'Exécuteur : faire grandir le joueur de missions du robot (liste → graphe, avec Si, Pour chaque, Selon l’échec), ou compiler le graphe vers l’arbre de comportement en atomes qui sait déjà répéter et replier ?',
  'Perception au niveau mission : « Voir », « Compter », « Pour chaque pièce vue » demandent une perception sans prise qui n’existe aujourd’hui qu’à l’intérieur d’une prise.',
  'Données entre étapes : le tableau noir (six faits) suffit-il, ou faut-il exposer « l’objet courant », « la prise tenue » et des variables de mission ?',
  'Enregistrer en le faisant : garder « Jouer puis ajouter » du cockpit comme manière d’ajouter un nœud au canevas ?',
  'Qui publie ? Un technicien méthodes peut-il publier une mission jouable en production, ou faut-il une validation ?',
  'Tablette d’abord : édition complète au doigt, ou lecture et lancement seulement sur tablette, édition sur ordinateur ?',
];
