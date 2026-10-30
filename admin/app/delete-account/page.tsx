'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setConfirmation('');
    try {
      const response = await fetch('/api/account-deletion-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’envoyer la demande.');
      setConfirmation(result.message);
      setEmail('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’envoyer la demande.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="account-deletion-page">
      <article className="account-deletion-card">
        <div className="account-deletion-brand" aria-label="ImoPrestige">
          <span>IMO</span>
          <span>PRESTIGE</span>
        </div>
        <p className="account-deletion-eyebrow">ImoPrestige</p>
        <h1>Demande de suppression de compte</h1>
        <p>
          Utilisez ce formulaire même si l’application de messagerie n’est pas installée. L’équipe
          vérifiera que l’adresse correspond au compte et traitera la demande manuellement.
        </p>

        <section className="account-deletion-steps" aria-labelledby="deletion-steps-title">
          <h2 id="deletion-steps-title">À savoir</h2>
          <ol>
            <li>Indiquez l’adresse e-mail associée à votre compte ImoPrestige.</li>
            <li>Un administrateur vérifiera la demande avant toute suppression.</li>
            <li>Le formulaire n’efface pas le compte immédiatement.</li>
          </ol>
        </section>

        <form className="account-deletion-form" onSubmit={submitRequest}>
          <label className="honeypot" aria-hidden="true">
            Site web
            <input
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={event => setWebsite(event.target.value)}
            />
          </label>
          <label htmlFor="deletion-email">Adresse e-mail du compte</label>
          <input
            id="deletion-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
          <button className="account-deletion-button" type="submit" disabled={saving}>
            {saving ? 'Envoi en cours…' : 'Envoyer la demande'}
          </button>
        </form>
        {error ? <p className="account-deletion-notice account-deletion-error" role="alert">{error}</p> : null}
        {confirmation ? (
          <p className="account-deletion-notice" role="status">{confirmation}</p>
        ) : null}
        {process.env.NEXT_PUBLIC_CONTACT_EMAIL ? (
          <p className="account-deletion-contact">
            Si le formulaire ne fonctionne pas, écrivez à{' '}
            <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}>
              {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
            </a>.
          </p>
        ) : null}
        <nav className="account-deletion-links" aria-label="Informations complémentaires">
          <a href="/privacy">Politique de confidentialité</a>
          <a href="/terms">Conditions d’utilisation</a>
        </nav>
      </article>
    </main>
  );
}
