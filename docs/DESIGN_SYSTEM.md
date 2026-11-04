# Système de Design - Imo Prestige Mobile

## 📚 Documentation du système de design

> Version 1.0.0 - November 2026

---

## 🎨 Palette de couleurs

### Couleurs principales (Light Theme)

| Token | Valeur | Usage |
|-------|--------|-------|
| `primary` | `#062C65` | Couleur principale (boutons, liens) |
| `primaryDark` | `#041E49` | Variante sombre de primary |
| `accent` | `#2E6DA6` | Couleurs d'accentuation |
| `background` | `#F5F8F8` | Fond principal |
| `surface` | `#FFFFFF` | Fonds des cartes, modals |
| `onSurface` | `#243538` | Texte principal |
| `border` | `#DFE8E8` | Bordures secondaires |

### États (Status Colors)

| État | Couleur | Container | Usage |
|------|---------|-----------|-------|
| `success` | `#15803D` | `#DCFCE7` | validations, succès |
| `warning` | `#B45309` | `#FEF3C7` | alertes, précaution |
| `danger` | `#B91C1C` | `#FEE2E2` | suppressions, erreurs |
| `info` | `#2563EB` | `#DBEAFE` | informations |

### Thèmes disponibles

```typescript
type ThemeMode = 'light' | 'dark' | 'nature' | 'rose';
```

- **light** : Thème clair par défaut
- **dark** : Thème sombre premium
- **nature** : Vert nature (option)
- **rose** : Rose/Violet (option)

---

## 🔤 Typographie

### Échelles typographiques

| Style | Taille | Poids | LineHeight | Usage |
|-------|--------|-------|------------|-------|
| `heroTitle` | 22px | 800 | 28 | Titres principaux |
| `title` | 18px | 700 | 24 | Titres de section |
| `subtitle` | 16px | 700 | 22 | Sous-titres |
| `body` | 14px | 400 | 20 | Corps de texte |
| `caption` | 11px | 600 | 14 | Légendes, badges |
| `button` | 14px | 700 | 18 | Texte boutons |
| `tabLabel` | 11px | 600 | 14 | Labels d'onglets |
| `badge` | 10px | 700 | 12 | Badges |

---

## 📏 Espacement & Rayons

### Échelle d'espacement

| Token | Valeur (px) | Usage typique |
|-------|-------------|---------------|
| `xs` | 4 | Séparateurs fins |
| `sm` | 8 | Marges intérieures petites |
| `md` | 12 | Marges intérieures standard |
| `lg` | 16 | Marges extérieures standard |
| `xl` | 20 | Grands espaces |
| `xxl` | 24 | Séparateurs de section |

### Rayons de bordure

| Token | Valeur (px) | Usage |
|-------|-------------|-------|
| `sm` | 8 | Chips, badges |
| `md` | 12 | Boutons petits |
| `lg` | 18 | Cartes petites |
| `xl` | 24 | Cartes, modals |
| `full` | 999 | Boutons, icônes ronds |

---

## 🧩 Composants UI

### Button

```tsx
import { Button } from '@/components/ui';

<Button
  title="Valider"
  variant="primary"  // 'primary' | 'secondary' | 'outline' | 'ghost'
  size="md"          // 'sm' | 'md' | 'lg'
  loading={false}
  disabled={false}
  onPress={() => {}}
/>
```

**Variantes :**
- `primary` : Fond bleu, texte blanc
- `secondary` : Fond blanc, bordure bleue, texte bleu
- `outline` : Fond transparent, bordure bleue, texte bleu
- `ghost` : Fond transparent, texte bleu

### Card

```tsx
import { Card } from '@/components/ui';

<Card variant="elevated" padding="md" rounded>
  {/* Contenu */}
</Card>
```

**Variantes :**
- `default` : Fond blanc, bordure fine
- `elevated` : Ombrage élévation
- `outlined` : Bordure visible
- `filled` : Fond gris clair

### Badge

```tsx
import { Badge } from '@/components/ui';

<Badge label="Premium" variant="premium" size="md" />
```

**Variantes :**
- `primary` : Fond bleu
- `secondary` : Fond blanc avec bordure
- `success` : Vert
- `warning` : Ambre
- `danger` : Rouge
- `premium` : Or foncé
- `featured` : Fond sombre avec texte or

### Input

```tsx
import { Input } from '@/components/ui';

<Input
  placeholder="Entrez votre nom"
  size="md"
  error={error ? "Champ requis" : undefined}
  onChangeText={setText}
/>
```

---

## 🛠️ Helpers

### useThemedStyles

Hook pour résoudre les styles selon le thème actuel.

```tsx
import { useThemedStyles } from '@/theme/useThemedStyles';

const styles = useThemedStyles(baseStyles);
```

### useThemeColors

Hook pour accéder aux couleurs du thème actuel.

```tsx
import { useThemeColors } from '@/theme/useThemedStyles';

const colors = useThemeColors();
// colors.primary, colors.surface, etc.
```

### Design Tokens

```tsx
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/theme/design-tokens';

// Accès direct aux valeurs
<COLORS.primary />
<TYPOGRAPHY.body />
<SPACING.lg />
<RADIUS.xl />
```

---

## 📱 Conventions React Native

### Touchables
- Utiliser `TouchableOpacity` avec `activeOpacity={0.85}` pour interactions
- Ajouter `accessibilityRole="button"` et `accessibilityState`

### Dimensions
- Marges horizontales : `SPACING.md` (12px) minimum
- Marges verticales : `SPACING.sm` (8px) minimum
- Touch targets : minimum 44x44px

### Shadow & Elevation
```tsx
// iOS & Android
{
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 3,
}
```

---

## 🔧 Mise à jour du système

Pour ajouter un nouveau composant :
1. Créez le fichier dans `src/components/ui/`
2. Exportez depuis `src/components/ui/index.ts`
3. Mettez à jour cette documentation

Pour modifier les tokens :
1. Modifiez les fichiers dans `src/theme/tokens/`
2. Les composants qui utilisent `useThemedStyles` s'adaptent automatiquement

---

## 📄 Fichiers clés

| Fichier | Description |
|---------|-------------|
| `src/theme/colors.ts` | Palette de couleurs |
| `src/theme/typography.ts` | Styles typographiques |
| `src/theme/spacing.ts` | Échelle d'espacement |
| `src/theme/design-tokens.ts` | Export unifié |
| `src/components/ui/Button.tsx` | Composant bouton |
| `src/components/ui/Card.tsx` | Composant carte |
| `src/components/ui/Badge.tsx` | Composant badge |
| `src/components/ui/Input.tsx` | Composant input |