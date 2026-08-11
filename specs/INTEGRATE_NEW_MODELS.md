# Especificación: Integración de Nuevos Modelos en Gemini CLI

Esta especificación detalla las instrucciones para que un agente de IA integre nuevos modelos de la familia Gemini en la configuración del núcleo (Core) de la aplicación y en el diálogo interactivo de selección de la interfaz CLI.

> **Cómo usar esta spec (agnóstica por diseño):**
> Validada contra `v0.56.0-nightly.20260811.geef19f25c`. En esa versión los
> modelos `gemini-3.5-flash-lite` y `gemini-3.6-flash` **NO existen** (ni sus
> constantes), así que este trabajo es 100% aditivo. Antes de hacer cambios, leé
> los 4 archivos que se mencionan y confirmá los anclajes:
> - `packages/core/src/config/models.ts` → `VALID_GEMINI_MODELS`
> - `packages/core/src/config/defaultModelConfigs.ts` → `aliases` y `modelDefinitions`
> - `packages/cli/src/ui/components/ModelDialog.tsx` → `manualModels` / `options`
> - Import de constantes desde `@google/gemini-cli-core` (el package del Core)
> Si en tu versión las constantes ya existen (los modelos vienen de fábrica), omití
> el paso correspondiente. Adaptá nombres/`extends`/`tier` a lo que encuentres.

---

## Objetivo
1. Registrar nuevos modelos (por ejemplo, `gemini-3.5-flash-lite` y `gemini-3.6-flash`) y habilitar su validación en el Core.
2. Definir aliases y especificaciones técnicas (como tier, familia, features de pensamiento y multimodalidad) para los nuevos modelos.
3. Actualizar el menú interactivo `/models` expuesto en la CLI para incluir las nuevas opciones de modelos disponibles para el usuario.

---

## Instrucciones Paso a Paso para el Agente

### Paso 1: Registrar Nuevos Modelos en Core
En `packages/core/src/config/models.ts`, añadir las constantes identificadoras de los nuevos modelos e incluirlas en el conjunto `VALID_GEMINI_MODELS` para permitir su correcta validación:
```typescript
export const GEMINI_3_5_FLASH_LITE_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_3_6_FLASH_MODEL = 'gemini-3.6-flash';

export const VALID_GEMINI_MODELS = new Set([
  // ... modelos existentes ...
  GEMINI_3_5_FLASH_LITE_MODEL,
  GEMINI_3_6_FLASH_MODEL,
]);
```

### Paso 2: Configurar Aliases y Heredar Configuraciones Base
En `packages/core/src/config/defaultModelConfigs.ts`, definir las relaciones de herencia bajo la propiedad `aliases` de la constante global de configuraciones (`DEFAULT_MODEL_CONFIGS`):
```typescript
    'gemini-3.5-flash-lite': {
      extends: 'chat-base-3',
      modelConfig: {
        model: 'gemini-3.5-flash-lite',
      },
    },
    'gemini-3.6-flash': {
      extends: 'chat-base-3',
      modelConfig: {
        model: 'gemini-3.6-flash',
      },
    },
```

### Paso 3: Definir Propiedades de los Modelos
En `packages/core/src/config/defaultModelConfigs.ts`, agregar los metadatos específicos del modelo en `modelDefinitions`:
```typescript
    'gemini-3.5-flash-lite': {
      tier: 'flash-lite',
      family: 'gemini-3',
      isPreview: false,
      isVisible: true,
      features: { thinking: false, multimodalToolUse: true },
    },
    'gemini-3.6-flash': {
      tier: 'flash',
      family: 'gemini-3',
      isPreview: false,
      isVisible: true,
      features: { thinking: false, multimodalToolUse: true },
    },
```

### Paso 4: Actualizar el Menú de Selección en el CLI
En `packages/cli/src/ui/components/ModelDialog.tsx`, importar las nuevas constantes de modelos desde `@google/gemini-cli-core` y añadirlas en los puntos clave de interacción:
- Importar `GEMINI_3_5_FLASH_LITE_MODEL` y `GEMINI_3_6_FLASH_MODEL`.
- Añadir las constantes al array `manualModels` de modo que se listen para la selección manual del usuario.
- Añadirlas al array `options` (en las rutas de renderizado interactivo / menús de soporte heredado) para que aparezcan correctamente en el comando interactivo `/models`.
