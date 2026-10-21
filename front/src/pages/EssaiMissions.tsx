import { FAMILLE, FAMILLES, ETATS, SORTIES, STATUTS, TONS, type Ton } from '../components/missions/charte';
import { CATALOGUE } from '../components/missions/catalogue';
import { CarteNoeud } from '../components/missions/Noeud';
import { EXIGENCES, EXISTANT, HISTOIRES, PERSONAS, PRINCIPES, QUESTIONS } from '../components/missions/proposition';
import { OndeExemple, Prototype } from '../components/missions/Prototype';

const SECTIONS: [string, string][] = [
  ['intention', 'L’intention'], ['existant', 'Ce qui existe'], ['personas', 'Pour qui'], ['histoires', 'User stories'],
  ['cahier', 'Cahier des charges'], ['principes', 'n8n × Scratch'], ['charte', 'Charte graphique'],
  ['composants', 'Composants'], ['prototype', 'Prototype'], ['questions', 'À trancher'],
];

const PRIORITE: Record<string, string> = { Doit: 'em-p-doit', Devrait: 'em-p-devrait', Pourrait: 'em-p-pourrait' };

const ONDES: [Ton, string][] = [['ok', 'après un succès'], ['echec', 'après un échec'], ['danger', 'arrêt d’urgence']];

/** La proposition d'éditeur de missions : du besoin au prototype (#/essai/missions). */
export function EssaiMissions() {
  return (
    <div className="em-page fond-hud">
      <nav className="em-sommaire" aria-label="Sommaire">
        <p className="essai-barre-sur">PROPOSITION</p>
        <strong>Éditeur de missions</strong>
        {SECTIONS.map(([id, nom], i) => <a key={id} href={`#/essai/missions`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}><span>{String(i + 1).padStart(2, '0')}</span>{nom}</a>)}
      </nav>

      <main className="em-contenu">
        <header className="em-entete" id="intention">
          <p className="essai-barre-sur">ESSAI · PROPOSITION · ÉDITEUR DE MISSIONS</p>
          <h1>Programmer le robot comme on assemble une automatisation</h1>
          <p className="em-chapeau">
            Une mission, c’est une suite de gestes enregistrés (prendre, déposer, rouler jusqu’à un poste) et la logique
            qui les relie : « pour chaque pièce », « si la prise échoue, réessaie », « quand le bac est plein, appelle
            quelqu’un ». On reprend la manière de n8n — un canevas de nœuds reliés, un panneau par étape, des exécutions
            qu’on rejoue — et la lisibilité de Scratch — des blocs qui se lisent comme des phrases, une couleur par
            famille, une forme par rôle, des boucles qui contiennent leurs étapes. Sans écrire de code.
          </p>
        </header>

        <section id="existant">
          <h2><span>01</span>Ce qui existe</h2>
          <p className="em-intro">Relevé dans le cockpit réel (mpc_dev) : les primitives, leurs réglages et leurs issues. L’éditeur ne réinvente aucun geste ; il assemble ceux-là.</p>
          <div className="em-tableau">
            <div className="em-ligne em-ligne-tete"><span>Primitive</span><span>Ce qu’elle fait</span><span>Réglages</span><span>Issues</span><span>Il lui faut</span></div>
            {EXISTANT.primitives.map((p) => (
              <div key={p.cle} className="em-ligne"><span><code>{p.cle}</code><b>{p.nom}</b></span><span>{p.fait}</span><span>{p.reglages}</span><span>{p.issues}</span><span>{p.prerequis}</span></div>
            ))}
          </div>
          <ul className="em-constats">{EXISTANT.constats.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>

        <section id="personas">
          <h2><span>02</span>Pour qui</h2>
          <div className="em-grille-4">
            {PERSONAS.map((p) => (
              <article key={p.cle} className="em-carte">
                <p className="em-carte-sur">{p.role}</p>
                <h3>{p.nom}</h3>
                <p><b>Sait :</b> {p.sait}</p>
                <p><b>Veut :</b> {p.veut}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="histoires">
          <h2><span>03</span>User stories</h2>
          <div className="em-grille-2">
            {HISTOIRES.map((h) => {
              const p = PERSONAS.find((x) => x.cle === h.persona)!;
              return (
                <article key={h.id} className="em-carte em-histoire">
                  <p className="em-carte-sur"><span>{h.id}</span>{p.nom} · {p.role}<i className={PRIORITE[h.priorite]}>{h.priorite}</i></p>
                  <p className="em-histoire-texte">En tant {p.en_tant}, <b>je veux {h.je_veux}</b>, afin de {h.afin_de}.</p>
                  <ul>{h.criteres.map((c) => <li key={c}>{c}</li>)}</ul>
                </article>
              );
            })}
          </div>
        </section>

        <section id="cahier">
          <h2><span>04</span>Cahier des charges</h2>
          <p className="em-intro">F : fonctionnel · N : non fonctionnel · S : sécurité. Priorités MoSCoW : <i className="em-p-doit">Doit</i> <i className="em-p-devrait">Devrait</i> <i className="em-p-pourrait">Pourrait</i>. Hors périmètre de la première version : un nœud de code libre, plusieurs robots dans une mission.</p>
          <div className="em-tableau em-tableau-exigences">
            {EXIGENCES.map((x) => (
              <div key={x.id} className="em-ligne"><span><code>{x.id}</code></span><span>{x.groupe}</span><span>{x.texte}</span><span><i className={PRIORITE[x.priorite]}>{x.priorite}</i></span></div>
            ))}
          </div>
        </section>

        <section id="principes">
          <h2><span>05</span>Ce qu’on prend à n8n et à Scratch</h2>
          <div className="em-grille-2">
            {PRINCIPES.map((p) => (
              <article key={p.idee} className="em-carte em-principe">
                <p className="em-carte-sur"><span className={`em-source em-source-${p.source.toLowerCase()}`}>{p.source}</span></p>
                <p>{p.idee}</p>
                <p className="em-chez-nous">→ {p.chez_nous}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="charte">
          <h2><span>06</span>Charte graphique</h2>
          <p className="em-intro">Dans la direction artistique de l’appli : le <b style={{ color: '#ff2d3a' }}>rouge</b> n’y sert qu’au danger, l’<b style={{ color: '#ffb02e' }}>ambre</b> à l’attention, le <b style={{ color: '#3dff8a' }}>vert</b> à l’OK. Aucune famille de nœuds ne les emprunte — sauf « Opérateur », qui est une attention. Un échec n’est pas un danger : il est ambre, en pointillé.</p>
          <h3 className="em-sous">Familles : la couleur et la forme</h3>
          <div className="em-grille-familles">
            {FAMILLES.map((f) => (
              <div key={f.cle} className="em-famille" style={{ ['--famille' as string]: f.couleur }}>
                <span className={`em-echantillon em-echantillon-${f.forme}`} />
                <div><b>{f.nom}</b><small>{f.role}</small><code>{f.couleur} · {f.forme}</code></div>
              </div>
            ))}
          </div>
          <h3 className="em-sous">Sorties et liens</h3>
          <div className="em-grille-sorties">
            {(Object.entries(SORTIES) as [keyof typeof SORTIES, (typeof SORTIES)[keyof typeof SORTIES]][]).filter(([, s]) => s.libelle).map(([k, s]) => (
              <div key={k} className="em-sortie-ex">
                <svg width="90" height="14" aria-hidden="true"><line x1="2" y1="7" x2="80" y2="7" stroke={s.couleur} strokeWidth="2" strokeDasharray={s.pointille ? '6 5' : undefined} /><path d="M80 2l8 5-8 5z" fill={s.couleur} /></svg>
                <span style={{ color: s.couleur }}>{s.libelle}</span>
              </div>
            ))}
          </div>
          <h3 className="em-sous">Pendant l’exécution : une onde vers l’étape en cours</h3>
          <div className="em-grille-ondes">
            {ONDES.map(([ton, texte]) => (
              <div key={ton} className="em-onde-ex">
                <OndeExemple ton={ton} />
                <span style={{ color: TONS[ton] }}>{texte}</span>
              </div>
            ))}
          </div>
          <h3 className="em-sous">États d’une étape : en haut à droite</h3>
          <div className="em-grille-etats">
            {(Object.keys(ETATS) as (keyof typeof ETATS)[]).map((e) => (
              <figure key={e}>
                <CarteNoeud type={CATALOGUE.find((t) => t.cle === 'prise_objet')!} valeurs={{ primitive: 'pièce' }} etat={e} />
                <figcaption>{ETATS[e].libelle}</figcaption>
              </figure>
            ))}
          </div>
          <h3 className="em-sous">Typographie et mesures</h3>
          <ul className="em-constats">
            <li>Inter pour les phrases des nœuds (0,86 rem, gras) ; mono majuscules espacées pour les familles, sorties et états.</li>
            <li>Un nœud tient sur une ligne : une icône, deux ou trois mots, ses réglages en pastilles. Son nom complet est dans l’info-bulle et dans ses réglages.</li>
            <li>Coins de 12 px ; cadre de boucle aux coins de 16 px, bordure pointillée de sa famille, numéro du tour en pastille.</li>
            <li>Sorties : un signe à côté de la poignée (✓ réussi, ✕ échoué, oui / non), jamais d’étiquette sur les liens.</li>
            <li>Poignées de 11 px (22 px de zone tactile), cibles d’au moins 44 px sur tablette ; grille de points de 24 px.</li>
            <li>Une pastille = un réglage ; une pastille hexagonale = une condition (vrai / faux), comme les booléens de Scratch.</li>
          </ul>
        </section>

        <section id="composants">
          <h2><span>07</span>Composants</h2>
          <p className="em-intro">Le catalogue complet, tel qu’il s’affiche sur le canevas. Chaque nœud est une entrée de catalogue : en ajouter un, c’est une ligne. Sous chacun, son statut : <span className="em-statut em-statut-existe">existe</span> au niveau des missions du cockpit, <span className="em-statut em-statut-atome">existe en atome</span> dans l’arbre de comportement, ou <span className="em-statut em-statut-nouveau">à construire</span>.</p>
          {FAMILLES.map((f) => {
            const ts = CATALOGUE.filter((t) => t.famille === f.cle);
            if (!ts.length) return null;
            return (
              <div key={f.cle} className="em-galerie-famille">
                <h3 className="em-sous" style={{ color: FAMILLE[f.cle].couleur }}>{f.nom}</h3>
                <div className="em-galerie">
                  {ts.map((t) => (
                    <figure key={t.cle}>
                      <CarteNoeud type={t} />
                      <figcaption>
                        <span className={`em-statut em-statut-${t.statut}`} title={STATUTS[t.statut].aide}>{STATUTS[t.statut].libelle}</span>
                        {t.aide}
                        {t.aujourdhui && <i>Aujourd’hui : {t.aujourdhui}.</i>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section id="prototype">
          <h2><span>08</span>Prototype</h2>
          <p className="em-intro">« Vider la table dans le bac » : aller à la table, pour chaque pièce vue la prendre (deux essais), la déposer, compter ; une pièce imprenable appelle l’opérateur ; à la fin, rentrer les bras et retourner à la base. « ▶ Simuler » joue une exécution : la première pièce passe, la seconde rate deux fois et l’opérateur est appelé. Clic droit sur un nœud : ses actions ; double-clic : ses réglages ; la palette, à droite, se glisse sur le canevas.</p>
          <Prototype />
        </section>

        <section id="questions">
          <h2><span>09</span>À trancher</h2>
          <ul className="em-constats">{QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ul>
        </section>
      </main>
    </div>
  );
}
