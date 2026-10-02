'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function MfaPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'verify' | 'enroll'>('verify');

  useEffect(() => {
    const boot = async () => {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        setError(aalError.message);
        setLoading(false);
        return;
      }
      if (aal?.currentLevel === 'aal2') {
        router.replace('/');
        return;
      }
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError(factorsError.message);
        setLoading(false);
        return;
      }
      const totp = factors?.totp.find(item => item.status === 'verified');
      if (totp) {
        setFactorId(totp.id);
        setMode('verify');
        setLoading(false);
        return;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Imo Nord Togo Admin',
      });
      if (enrollError || !data) {
        setError(enrollError?.message ?? 'Impossible d’activer le 2FA.');
        setLoading(false);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setMode('enroll');
      setLoading(false);
    };
    void boot();
  }, [router]);

  const submit = async () => {
    if (!factorId || code.trim().length < 6) {
      setError('Entrez le code à 6 chiffres.');
      return;
    }
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? 'Challenge 2FA impossible.');
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.replace('/');
  };

  if (loading) {
    return <div className="login-shell">Préparation du 2FA...</div>;
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>
          {mode === 'enroll' ? 'Activer le 2FA admin' : 'Vérification 2FA'}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          Obligatoire pour les comptes ADMIN. Scannez le QR dans une application d’authentification.
        </div>
        {qr ? (
          <div className="qr-box">
            <img src={qr} alt="QR 2FA" />
            {secret ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Clé : {secret}</div> : null}
          </div>
        ) : null}
        <div className="form-field">
          <label>Code</label>
          <input value={code} onChange={event => setCode(event.target.value)} placeholder="123456" />
        </div>
        {error ? <div className="alert">{error}</div> : null}
        <button className="primary-button" onClick={submit}>
          Valider
        </button>
      </div>
    </div>
  );
}
