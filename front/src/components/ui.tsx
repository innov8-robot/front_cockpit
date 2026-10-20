import type { ReactNode } from 'react';
import type { Ton } from '../api/libelles';

export function Badge({ ton, children }: { ton: Ton; children: ReactNode }) {
  return <span className={`badge badge-${ton}`}>{children}</span>;
}

export function EnTete({ titre, sousTitre, actions }: { titre: string; sousTitre?: string; actions?: ReactNode }) {
  return (
    <header className="entete">
      <div>
        <h1>{titre}</h1>
        {sousTitre && <p className="discret">{sousTitre}</p>}
      </div>
      {actions && <div className="entete-actions">{actions}</div>}
    </header>
  );
}

export function Chargement() {
  return <div className="chargement" aria-busy="true">Chargement…</div>;
}

export function Erreur({ message }: { message: string }) {
  return <div className="alerte alerte-danger" role="alert">{message}</div>;
}

export function Vide({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <div className="vide">
      <strong>{titre}</strong>
      {children && <div className="discret">{children}</div>}
    </div>
  );
}

export function Batterie({ niveau }: { niveau: number }) {
  const ton = niveau < 20 ? 'danger' : niveau < 40 ? 'alerte' : 'ok';
  return (
    <span className="batterie" title={`Batterie ${niveau} %`}>
      <span className="batterie-jauge">
        <span className={`batterie-niveau fond-${ton}`} style={{ width: `${niveau}%` }} />
      </span>
      <span className="nombre">{niveau} %</span>
    </span>
  );
}

const CHEMINS: Record<string, string> = {
  robot: 'M9 3h6v5H9zM7 10h10v7H7zM9 17v4M15 17v4M5 12v3M19 12v3',
  primitives: 'M4 6h7v7H4zM13 6h7v4h-7zM13 12h7v6h-7zM4 15h7v3H4z',
  missions: 'M5 5h14M5 12h14M5 19h9M17 17l2 2 3-4',
  plus: 'M12 5v14M5 12h14',
  retour: 'M15 18l-6-6 6-6',
  haut: 'M6 15l6-6 6 6',
  bas: 'M6 9l6 6 6-6',
  croix: 'M6 6l12 12M18 6L6 18',
  jouer: 'M7 5l12 7-12 7z',
  stop: 'M6 6h12v12H6z',
  enregistrer: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
};

export function Icone({ nom, taille = 20 }: { nom: keyof typeof CHEMINS | string; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CHEMINS[nom]} />
    </svg>
  );
}
