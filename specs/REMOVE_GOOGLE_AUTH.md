# Especificación: Eliminación Completa de Autenticación con Google (OAuth Personal)

Esta especificación detalla las instrucciones para que un agente de IA elimine por completo el soporte de inicio de sesión con Google (OAuth Personal / `LOGIN_WITH_GOOGLE` / `oauth-personal`) en Gemini CLI, asegurando que `USE_GEMINI` (`gemini-api-key`) quede como el método primario y predeterminado.

> **Cómo usar esta spec (agnóstica por diseño):**
> Validada contra `v0.56.0-nightly.20260811.geef19f25c`; todos los anclajes de abajo
> existen ahí (enum en `contentGenerator.ts`, `upgradeCommand` en
> `BuiltinCommandLoader.ts`, y referencias en `Footer.tsx`, `PrivacyNotice.tsx`,
> `useQuotaAndFallback.ts`). Antes de editar, corré un barrido completo para no dejar
> referencias rotas:
> ```bash
> grep -rn "LOGIN_WITH_GOOGLE\|oauth-personal" packages/ | grep -v test
> ```
> y re-aplicá cada aparición. **La parte crítica es el Paso 1**: como otras partes del
> repo construyen `AuthType` desde env, quitarlo del enum rompe el type-check si
> dejás una rama que lo devuelve (ver nota al final del Paso 1).

---

## Objetivo
1. Remover el valor `LOGIN_WITH_GOOGLE` del enum `AuthType` en `packages/core/src/core/contentGenerator.ts`, **y de cualquier función que lo construya desde env** (`getAuthTypeFromEnv`).
2. Eliminar referencias y condiciones asociadas a `AuthType.LOGIN_WITH_GOOGLE` en la carga de comandos (`BuiltinCommandLoader.ts`).
3. Limpiar interfaces y componentes de UI (`Footer.tsx`, `PrivacyNotice.tsx`, `useQuotaAndFallback.ts`) para eliminar flujos y diálogos condicionados a la autenticación de Google.
4. Ajustar pruebas unitarias y de integración para reflejar la eliminación del soporte de inicio de sesión de Google.

---

## Instrucciones Paso a Paso para el Agente

### Paso 1: Modificar el Enum `AuthType` en Core
En `packages/core/src/core/contentGenerator.ts`, quitar la entrada `LOGIN_WITH_GOOGLE` del enum `AuthType`:
```typescript
export enum AuthType {
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  LEGACY_CLOUD_SHELL = 'cloud-shell',
  COMPUTE_ADC = 'compute-default-credentials',
  GATEWAY = 'gateway',
}
```

> **⚠️ Crítico (rompe el build si se omite):** en v0.55/v0.56, `getAuthTypeFromEnv()`
> (mismo archivo) tiene una rama así:
> ```typescript
> if (process.env['GOOGLE_GENAI_USE_GCA'] === 'true') {
>   return AuthType.LOGIN_WITH_GOOGLE;
> }
> ```
> Al quitar el miembro del enum, esa línea ya no compila. Eliminala (o hacé la
> función devolver `undefined` en ese caso). Buscá también `'oauth-personal'` como
> string literal en configs/documentos de settings por si queda colgado.

### Paso 2: Remover Lógica de Comandos Basada en Google Auth
En `packages/cli/src/services/BuiltinCommandLoader.ts`, eliminar la carga condicional del comando `upgradeCommand` (o cualquier comando exclusivo de usuarios autenticados con Google):
```typescript
// Eliminar o limpiar la lógica de adición de comandos según authType:
const allDefinitions = [
  // ... comandos estándar ...
  // Quitar la línea que agrega upgradeCommand basándose en AuthType.LOGIN_WITH_GOOGLE
];
```

### Paso 3: Limpiar el Componente de Pie de Página (Footer)
En `packages/cli/src/ui/components/Footer.tsx`, remover la visualización del correo de Google o estados exclusivos de `LOGIN_WITH_GOOGLE`:
```typescript
// Cambiar lógica condicional que comprueba AuthType.LOGIN_WITH_GOOGLE
// para no renderizar enlaces de actualización de plan o cuentas de Google.
```

### Paso 4: Actualizar Lógica de Aviso de Privacidad y Fallback de Cuotas
- En `packages/cli/src/ui/privacy/PrivacyNotice.tsx`, eliminar el caso `AuthType.LOGIN_WITH_GOOGLE` del flujo de visualización de políticas de privacidad.
- En `packages/cli/src/ui/hooks/useQuotaAndFallback.ts`, quitar el condicional que ofrece cambiar a Gemini API Key cuando el usuario está logueado con Google y se agota su cuota.

### Paso 5: Actualizar Pruebas
Eliminar o reescribir los casos de prueba que configuran u operan con `AuthType.LOGIN_WITH_GOOGLE` en:
- `packages/cli/src/ui/components/UserIdentity.test.tsx`
- `packages/cli/src/ui/components/ProQuotaDialog.test.tsx`
- `packages/cli/src/ui/hooks/useQuotaAndFallback.test.ts`
- `packages/cli/src/services/BuiltinCommandLoader.test.ts`
- `packages/cli/src/config/auth.test.ts`
