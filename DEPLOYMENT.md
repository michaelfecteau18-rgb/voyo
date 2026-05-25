# VOYO — Guide de déploiement complet

## Prérequis

- Node.js ≥ 20.0
- npm ≥ 10.0
- Supabase CLI
- Compte Vercel
- Compte Twilio (SMS)
- Compte Firebase (Push)
- Compte Mapbox

---

## 1. Variables d'environnement

### apps/web/.env.local

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

# App
NEXT_PUBLIC_APP_URL=https://app.voyo.ca
```

### Backend (Supabase Edge Functions)

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhb...

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=xxxxxx
TWILIO_PHONE_NUMBER=+15141234567

# Firebase Admin
FIREBASE_PROJECT_ID=voyo-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@voyo-prod.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

---

## 2. Setup Supabase

```bash
# Installer Supabase CLI
npm install -g supabase

# Authentification
supabase login

# Créer le projet (depuis la console Supabase)
# https://app.supabase.com/new

# Lier le projet local
supabase link --project-ref VOTRE_PROJECT_REF

# Appliquer les migrations
supabase db push

# Déployer les Edge Functions
supabase functions deploy gps-processor

# Activer les extensions requises (depuis la console SQL)
# CREATE EXTENSION IF NOT EXISTS "postgis";
# CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

# Configurer Realtime (console Supabase > Database > Replication)
# Activer pour: gps_locations, trips, attendance, notifications, messages
```

---

## 3. Déploiement Web (Vercel)

```bash
# Installer Vercel CLI
npm install -g vercel

# Depuis le dossier apps/web
cd apps/web

# Déployer
vercel --prod

# Configurer les variables d'env dans la console Vercel
# vercel env add NEXT_PUBLIC_SUPABASE_URL production
# vercel env add NEXT_PUBLIC_MAPBOX_TOKEN production
```

### vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "cd ../.. && npm run build --workspace=apps/web",
  "outputDirectory": "apps/web/.next",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" }
      ]
    }
  ]
}
```

---

## 4. App Mobile (Expo)

```bash
# Installer EAS CLI
npm install -g eas-cli

# Authentification
eas login

# Configurer le projet
cd apps/mobile
eas build:configure

# Build de prévisualisation (TestFlight / Internal Testing)
eas build --platform all --profile preview

# Build de production
eas build --platform all --profile production

# Soumettre aux stores
eas submit --platform ios
eas submit --platform android
```

### eas.json

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "ios": { "resourceClass": "m1-medium" }
    }
  }
}
```

---

## 5. Configuration Firebase (Push Notifications)

1. Créer un projet Firebase: https://console.firebase.google.com
2. Ajouter les apps iOS et Android
3. Télécharger `google-services.json` → `apps/mobile/android/app/`
4. Télécharger `GoogleService-Info.plist` → `apps/mobile/ios/`
5. Générer une clé de compte de service:
   - Firebase Console > Paramètres > Comptes de service
   - Générer une nouvelle clé privée
   - Copier les valeurs dans les variables Supabase

---

## 6. Configuration Twilio (SMS)

1. Créer un compte Twilio: https://console.twilio.com
2. Acheter un numéro canadien (ex: +1 514 XXX XXXX)
3. Pour la production canadienne: enregistrer le numéro pour l'A2P 10DLC
4. Ajouter les credentials dans les variables Supabase

---

## 7. Configuration Mapbox

1. Créer un compte: https://account.mapbox.com
2. Créer un token avec les scopes: `styles:read`, `tiles:read`
3. Ajouter le token dans les variables d'env web et mobile
4. Style recommandé: `mapbox://styles/mapbox/light-v11`

---

## 8. Checklist pré-lancement

### Sécurité
- [ ] RLS activé sur toutes les tables
- [ ] Politiques RLS testées pour chaque rôle
- [ ] Variables d'env ne sont pas dans le code
- [ ] CORS configuré sur Supabase
- [ ] Rate limiting activé
- [ ] Audit logs opérationnels

### Performance
- [ ] Index DB vérifiés avec EXPLAIN ANALYZE
- [ ] Partitionnement gps_locations configuré
- [ ] Réplication Supabase activée pour les bonnes tables
- [ ] CDN Vercel configuré

### Légal (Canada)
- [ ] Politique de confidentialité PIPEDA conforme
- [ ] Consentement parental explicite pour les mineurs
- [ ] Droit à l'effacement des données implémenté
- [ ] Mentions FERPA pour les données scolaires
- [ ] Conditions d'utilisation en français

### Opérations
- [ ] Monitoring Supabase activé
- [ ] Alertes configurées (erreurs, latence GPS)
- [ ] Backup automatique PostgreSQL (activé par défaut Supabase)
- [ ] Support email configuré: support@voyo.ca

---

## 9. Structure finale du monorepo

```
voyo/
├── apps/
│   ├── web/                # Next.js 14 — Dashboard web
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   ├── (dispatcher)/
│   │   │   │   ├── (admin)/
│   │   │   │   └── (parent)/
│   │   │   ├── components/
│   │   │   │   ├── dispatcher/
│   │   │   │   ├── admin/
│   │   │   │   └── ui/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── store/
│   │   └── package.json
│   ├── mobile/             # React Native Expo — App parent + chauffeur
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── parent/
│   │   │   │   ├── driver/
│   │   │   │   └── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── navigation/
│   │   └── package.json
│   └── admin/              # Next.js — Portail super admin
├── packages/
│   ├── types/              # Types TypeScript partagés
│   ├── db/                 # Client Supabase + helpers
│   ├── utils/              # ETA, notifications, helpers
│   ├── ui/                 # Composants partagés
│   └── config/             # Configs ESLint, TS, Tailwind
├── supabase/
│   ├── migrations/         # Schema SQL versionné
│   ├── functions/          # Edge Functions Deno
│   └── seed/               # Données de test
└── package.json            # Monorepo root
```

---

## 10. Commandes de développement

```bash
# Installer toutes les dépendances
npm install

# Démarrer en développement (web + supabase local)
supabase start
npm run dev --workspace=apps/web

# App mobile (nécessite Expo Go ou simulateur)
npm run dev --workspace=apps/mobile

# Générer les types depuis le schema Supabase
npm run db:types

# Appliquer les nouvelles migrations
npm run db:migrate

# Tests
npm run test

# Build de production
npm run build
```
