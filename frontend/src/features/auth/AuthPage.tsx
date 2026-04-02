import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { Role } from '../../types';

export function AuthPage() {
  const { role } = useParams();
  const resolvedRole = (role === 'caretaker' ? 'caretaker' : 'elder') as Role;
  const { login } = useAuth();
  const { t } = usePreferences();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('fullName') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const rememberMe = formData.get('rememberMe') === 'on';

    if (!fullName) {
      setError('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const user = await login({
        role: resolvedRole,
        fullName,
        email: email || undefined,
        phone: phone || undefined,
        rememberMe,
      });
      navigate(user.role === 'elder' ? '/elder' : '/caretaker');
    } catch (err: any) {
      setError(err.message || 'Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="panel">
        <p className="eyebrow">{resolvedRole === 'elder' ? t('elderRole') : t('caretakerRole')}</p>
        <h2>{t('authTitle')}</h2>
        <p className="muted">{t('authSubtitle')}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>{t('fullName')}</span>
            <input name="fullName" placeholder="Asha Devi" />
          </label>
          <label>
            <span>{t('email')}</span>
            <input name="email" type="email" placeholder="family@example.com" />
          </label>
          <label>
            <span>{t('phone')}</span>
            <input name="phone" placeholder="+91..." />
          </label>
          <label className="checkbox-row">
            <input name="rememberMe" type="checkbox" defaultChecked />
            <span>{t('rememberMe')}</span>
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? t('signingIn') : t('continue')}
          </button>
        </form>
      </div>
    </section>
  );
}
