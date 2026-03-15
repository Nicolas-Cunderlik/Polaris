import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import './index.css';
import App from './App.tsx';
import { AppWrapper } from './components/common/PageMeta.tsx';

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

if (!auth0Domain || !auth0ClientId) {
  throw new Error('Missing Auth0 configuration. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.');
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={(appState) => {
        const returnTo = typeof appState?.returnTo === 'string' ? appState.returnTo : '/';
        window.history.replaceState({}, document.title, returnTo);
      }}
    >
      <AppWrapper>
        <App />
      </AppWrapper>
    </Auth0Provider>
  </StrictMode>
);
