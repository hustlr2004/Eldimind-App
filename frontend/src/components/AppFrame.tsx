import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../app/auth/AuthProvider';
import { usePreferences } from '../app/preferences/PreferencesProvider';
import { InstallPrompt } from './InstallPrompt';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = usePreferences();
  const location = useLocation();

  return (
    <div className="app-root">
      <a className="skip-link" href="#main-content">
        {t('skipToContent')}
      </a>
      <header className="topbar">
        <Link className="brand" to={user ? (user.role === 'elder' ? '/elder' : '/caretaker') : '/'}>
          EldiMind
        </Link>
        <div className="topbar-actions">
          <select
            className="language-switch"
            aria-label="Language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'hi' | 'kn')}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="kn">ಕನ್ನಡ</option>
          </select>
          {user ? (
            <>
              <Link className="ghost-button" to="/settings">
                Settings
              </Link>
              <button className="ghost-button" onClick={() => void logout()}>
                Log out
              </button>
            </>
          ) : location.pathname !== '/' ? (
            <Link className="ghost-button" to="/">
              Home
            </Link>
          ) : null}
        </div>
      </header>
      <InstallPrompt />
      <main id="main-content">{children}</main>
    </div>
  );
}
