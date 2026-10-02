'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) setReady(true);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const save = async () => {
    if (password.length < 6 || password !== confirm) {
      setError('Les mots de passe doivent correspondre (6 caractères min.).');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setInfo('Mot de passe mis à jour.');
    setTimeout(() => router.replace('/login'), 800);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>
          Nouveau mot de passe
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          Choisissez un mot de passe. L’administrateur ne voit jamais l’ancien.
        </div>
        {!ready ? (
          <div style={{ color: 'var(--muted)' }}>Ouvrez le lien reçu par e-mail pour continuer.</div>
        ) : (
          <>
            <div className="form-field">
              <label>Nouveau mot de passe</label>
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} />
            </div>
            <div className="form-field">
              <label>Confirmation</label>
              <input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} />
            </div>
          </>
        )}
        {error ? <div className="alert">{error}</div> : null}
        {info ? <div className="success">{info}</div> : null}
        <button className="primary-button" onClick={save} disabled={!ready}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
