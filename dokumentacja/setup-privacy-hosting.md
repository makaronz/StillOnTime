# Konfiguracja hostingu dla polityki prywatności

## Opcja 1: GitHub Pages (ZALECANA)

### Kroki:
1. Utwórz nowe repozytorium na GitHub: `stillontime-privacy`
2. Skopiuj `privacy-policy.html` jako `index.html`
3. Push do repo:
   ```bash
   git init
   git add index.html
   git commit -m "Add privacy policy"
   git remote add origin https://github.com/TWOJA_NAZWA/stillontime-privacy.git
   git push -u origin main
   ```
4. Włącz GitHub Pages w Settings → Pages
5. Link: `https://TWOJA_NAZWA.github.io/stillontime-privacy`

## Opcja 2: Netlify (Bardzo łatwa)

### Kroki:
1. Idź na https://netlify.com
2. Drag & drop folder z `privacy-policy.html`
3. Zmień nazwę na `stillontime-privacy`
4. Link: `https://stillontime-privacy.netlify.app`

## Opcja 3: Dodaj do istniejącej aplikacji

### Frontend (React):
```tsx
// src/pages/PrivacyPolicy.tsx
import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="privacy-policy">
      {/* Zawartość z privacy-policy.html */}
    </div>
  );
};

export default PrivacyPolicy;
```

### Routing:
```tsx
// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import PrivacyPolicy from './pages/PrivacyPolicy';

function App() {
  return (
    <Routes>
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      {/* inne routy */}
    </Routes>
  );
}
```

### Link będzie: `https://twoja-domena.com/privacy-policy`

## Wymagania Google OAuth:
- ✅ Publiczny dostęp (bez logowania)
- ✅ Stabilny URL
- ✅ HTTPS
- ✅ Wszystkie wymagane informacje

## Testowanie:
```bash
# Sprawdź dostępność
curl -I https://your-privacy-policy-url.com

# Sprawdź zawartość
curl https://your-privacy-policy-url.com
```
