import { Link } from 'react-router-dom';
import { usePreferences } from '../../app/preferences/PreferencesProvider';

export function LandingPage() {
  const { t } = usePreferences();

  return (
    <section className="hero-page">
      <div className="hero-copy">
        <p className="eyebrow">{t('tagline')}</p>
        <h1>{t('landingTitle')}</h1>
        <p className="hero-text">{t('landingSubtitle')}</p>
      </div>

      <div className="role-grid">
        <Link className="role-card elder-card" to="/auth/elder">
          <span className="role-icon">E</span>
          <strong>{t('elderRole')}</strong>
          <p>{t('elderRoleDesc')}</p>
        </Link>
        <Link className="role-card caretaker-card" to="/auth/caretaker">
          <span className="role-icon">C</span>
          <strong>{t('caretakerRole')}</strong>
          <p>{t('caretakerRoleDesc')}</p>
        </Link>
      </div>
    </section>
  );
}
