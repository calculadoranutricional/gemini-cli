# Especificación: Rotación de API Keys (GEMINI_API_KEYS) en Gemini CLI

Esta especificación detalla las instrucciones para que un agente de IA habilite el
soporte de múltiples claves de API Gemini mediante la variable de entorno
`GEMINI_API_KEYS` (separadas por comas, máx. 5) e implemente rotación round-robin
por petición, con:
- Logs de depuración con **claves enmascaradas** (`AIza***1rY`).
- Reintento transparente con la siguiente clave ante errores de cuota
  (HTTP 429 / 499 / 503 y `TerminalQuotaError` / `RetryableQuotaError`).
- `countTokens` / `embedContent` que NO avanzan el contador de rotación.

> **Cómo usar esta spec (importante, agnóstica por diseño):**
> El código fuente de gemini-cli cambia entre versiones (0.53 → 0.54 → 0.55 → 0.56).
> Esta spec se escribió y validó contra `v0.56.0-nightly.20260811.geef19f25c`, cuyo
> `ContentGenerator` es:
> ```ts
> interface ContentGenerator {
>   generateContent(request: GenerateContentParameters, userPromptId: string, role: LlmRole): Promise<GenerateContentResponse>;
>   generateContentStream(request: GenerateContentParameters, userPromptId: string, role: LlmRole): Promise<AsyncGenerator<GenerateContentResponse>>;
>   countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;
>   embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;
>   userTier?: UserTierId; userTierName?: string; paidTier?: GeminiUserTier;
> }
> ```
> **Antes de tocar código, leé lo real**: en tu checkout ejecutá
> `grep -n "interface ContentGenerator" packages/core/src/core/contentGenerator.ts`
> y confirmá esa firma. Si difiere, adaptá `Paso 1` a la firma real (no inventes
> una). Lo demás (nombres de archivos, utilidades) está confirmado para v0.56.

---

## Objetivo
1. Implementar `RotatingContentGenerator` que encapsule la rotación round-robin
   entre múltiples `ContentGenerator`.
2. Configurar la carga de `GEMINI_API_KEYS` en la creación del generador.
3. Loggear la rotación en modo debug con claves enmascaradas.
4. No avanzar el contador en `countTokens`/`embedContent`.
5. Reintentar con la siguiente clave en errores de cuota (429, 499, 503).

---

## Paso 1: Crear `packages/core/src/core/rotatingContentGenerator.ts`

Contenido completo (validado contra v0.56; la lógica de reintento usa
`TerminalQuotaError`/`RetryableQuotaError`, que existen en
`packages/core/src/utils/googleQuotaErrors.ts`, y `getErrorStatus` de
`packages/core/src/utils/httpErrors.ts`):

```typescript
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';
import {
  TerminalQuotaError,
  RetryableQuotaError,
} from '../utils/googleQuotaErrors.js';
import { getErrorStatus } from '../utils/httpErrors.js';
import { debugLogger } from '../utils/debugLogger.js';
import type { LlmRole } from '../telemetry/llmRole.js';
import type { UserTierId, GeminiUserTier } from '../code_assist/types.js';

const QUOTA_ERROR_STATUSES = new Set([429, 499, 503]);

export class RotatingContentGenerator implements ContentGenerator {
  private static rotationIndex = 0;

  private readonly generators: readonly ContentGenerator[];

  private readonly keyIds: readonly string[];

  constructor(
    generators: ReadonlyArray<ContentGenerator>,
    keyIds: ReadonlyArray<string> = [],
  ) {
    if (generators.length < 2) {
      throw new Error(
        'RotatingContentGenerator requires at least 2 generators',
      );
    }
    if (generators.length > 5) {
      throw new Error(
        'RotatingContentGenerator supports at most 5 generators',
      );
    }
    this.generators = [...generators];
    this.keyIds = [...keyIds];
  }

  /** @internal Resets the process-wide rotation counter (test isolation). */
  static resetRotationIndexForTesting(): void {
    RotatingContentGenerator.rotationIndex = 0;
  }

  get userTier(): UserTierId | undefined {
    return this.generators[0]?.userTier;
  }

  get userTierName(): string | undefined {
    return this.generators[0]?.userTierName;
  }

  get paidTier(): GeminiUserTier | undefined {
    return this.generators[0]?.paidTier;
  }

  private nextGenerator(): ContentGenerator {
    const index =
      RotatingContentGenerator.rotationIndex % this.generators.length;
    RotatingContentGenerator.rotationIndex += 1;
    debugLogger.debug(
      `[api-key-rotation] request #${RotatingContentGenerator.rotationIndex} -> apiKey[${
        this.keyIds[index] ?? index + 1
      }]`,
    );
    return this.generators[index];
  }

  private currentGenerator(): ContentGenerator {
    const index =
      RotatingContentGenerator.rotationIndex % this.generators.length;
    return this.generators[index];
  }

  private static isQuotaError(error: unknown): boolean {
    if (
      error instanceof TerminalQuotaError ||
      error instanceof RetryableQuotaError
    ) {
      return true;
    }
    const status = getErrorStatus(error);
    return status !== undefined && QUOTA_ERROR_STATUSES.has(status);
  }

  async generateContent(
    req: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<GenerateContentResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.generators.length; attempt++) {
      const generator = this.nextGenerator();
      try {
        return await generator.generateContent(req, userPromptId, role);
      } catch (error) {
        if (!RotatingContentGenerator.isQuotaError(error)) {
          throw error;
        }
        lastError = error;
      }
    }
    throw lastError;
  }

  async generateContentStream(
    req: GenerateContentParameters,
    userPromptId: string,
    role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.generators.length; attempt++) {
      const generator = this.nextGenerator();
      try {
        return await generator.generateContentStream(req, userPromptId, role);
      } catch (error) {
        if (!RotatingContentGenerator.isQuotaError(error)) {
          throw error;
        }
        lastError = error;
      }
    }
    throw lastError;
  }

  async countTokens(
    req: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return this.currentGenerator().countTokens(req);
  }

  async embedContent(
    req: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    return this.currentGenerator().embedContent(req);
  }
}
```

Notas de implementación (por qué es así):
- **Firma**: `generateContent(req, userPromptId, role)` — DEBE matchear la interfaz
  real. Si tu versión tiene otros parámetros, adaptalos.
- **Tipos**: `GenerateContentResponse`, `CountTokensParameters`, etc. se importan
  de `@google/genai`, NO de `./contentGenerator.js` (ese módulo no los re-exporta).
- **Reintento**: el loop prueba cada generador una vez ante errores de cuota; si
  todas fallan, relanza el último error. Sin eso (la versión naive que solo llama
  `nextGenerator()` una vez) NO se cumple el objetivo 5.
- **Tier**: los getters `userTier`/`userTierName`/`paidTier` son requeridos por el
  CLI para reportar el plan del usuario (delegamos al primer generador).

---

## Paso 2: Utilidades y campo `apiKeys` en `packages/core/src/core/contentGenerator.ts`

Agregar al archivo (junto a la interfaz):

```typescript
/**
 * Maximum number of Gemini API keys that can be used with key rotation.
 */
export const MAX_GEMINI_API_KEYS = 5;

/**
 * Parses a comma-separated list of API keys (e.g. from the GEMINI_API_KEYS
 * environment variable) into a trimmed array, dropping empty entries and
 * capping the number of keys at MAX_GEMINI_API_KEYS.
 */
export function parseApiKeys(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .slice(0, MAX_GEMINI_API_KEYS);
}

/**
 * Creates a short, masked representation of an API key for debug logs so the
 * console never shows the full secret (e.g. "AIza***1rY").
 */
export function maskApiKey(
  key: string,
  maxPrefixLength = 4,
  maxSuffixLength = 4,
  mask = '***',
): string {
  if (key.length <= maxPrefixLength + maxSuffixLength) {
    return mask;
  }
  return `${key.slice(0, maxPrefixLength)}${mask}${key.slice(-maxSuffixLength)}`;
}
```

Y extender el tipo `ContentGeneratorConfig` (está en el mismo archivo) para
soportar múltiples claves:

```typescript
export type ContentGeneratorConfig = {
  apiKey?: string;
  apiKeys?: string[]; // <-- NUEVO: lista de claves de GEMINI_API_KEYS
  vertexai?: boolean;
  authType?: AuthType;
  proxy?: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
  vertexAiRouting?: VertexAiRoutingConfig;
};
```

---

## Paso 3: Cargar `GEMINI_API_KEYS` en `createContentGeneratorConfig`

En el mismo `contentGenerator.ts`, dentro de `createContentGeneratorConfig`, justo
después de la línea `const geminiApiKey = ...` (que usa el helper `getEnv`, ya
definido en esa función), agregar el parseo:

```typescript
  const geminiApiKeys = parseApiKeys(getEnv('GEMINI_API_KEYS'));
```

Y modificar la rama `USE_GEMINI` para que, si hay varias claves, se prioricen:

```typescript
  if (authType === AuthType.USE_GEMINI && (geminiApiKey || geminiApiKeys.length > 0)) {
    contentGeneratorConfig.apiKey = geminiApiKeys.length > 0 ? geminiApiKeys[0] : geminiApiKey;
    contentGeneratorConfig.vertexai = false;

    // Rotación: si hay más de una clave, se guardan todas.
    if (geminiApiKeys.length > 1) {
      contentGeneratorConfig.apiKeys = geminiApiKeys;
    }

    return contentGeneratorConfig;
  }
```

Verificá que en tu versión el helper para leer env se llame `getEnv` (en v0.56
está definido <em>adentro</em> de `createContentGeneratorConfig`).
`geminiApiKey` ya incluye `loadApiKey()`; no alteres ese orden.

---

## Paso 4: Componer el generador rotativo en `createContentGenerator`

Este es el cambio más delicado. En v0.56, `createContentGenerator` tiene esta
estructura (verificada):

```typescript
export async function createContentGenerator(...) {
  const generator = await (async () => {
    if (gcConfig.fakeResponsesNonStrict) { ... return new LoggingContentGenerator(fake, gcConfig); }
    if (gcConfig.fakeResponses) { ... return new LoggingContentGenerator(fake, gcConfig); }
    const version = await getVersion();
    const model = resolveModel(...);
    const customHeadersEnv = ...;
    const clientName = ...;
    const surface = determineSurface();
    // ── desde aquí en adelante, todo el cuerpo va a tu nuevo helper ──
    let userAgent: string;
    ...
    return new LoggingContentGenerator(googleGenAI.models, gcConfig);
    // ── fin del cuerpo a extraer ──
  })();
  if (gcConfig.recordResponses) {
    return new RecordingContentGenerator(generator, gcConfig.recordResponses);
  }
  return generator;
}
```

El agente debe hacer **un refactor, no pegar código desde cero**:

0. **Agregar el import** del nuevo módulo (junto a los otros imports de generadores):
   ```typescript
   import { RotatingContentGenerator } from './rotatingContentGenerator.js';
   ```

1. **Declarar antes del IIFE** el arreglo de máscaras:
   ```typescript
   let keyKeys: string[] = [];
   ```
   (Ojo: declarar `keyKeys` adentro del IIFE y usarlo afuera rompe el build con
   "keyKeys is not defined".)

2. **Extraer el cuerpo** que va de `let userAgent: string;` hasta el
   `return new LoggingContentGenerator(googleGenAI.models, gcConfig);` de la rama
   USE_GEMINI/USE_VERTEX_AI/GATEWAY (incluyendo también la rama
   LOGIN_WITH_GOOGLE/COMPUTE_ADC si tu versión la conserva) y envolverlo en un
   helper **dentro del IIFE**, reemplazando `config.apiKey` por el parámetro:

   ```typescript
   const buildGeneratorForApiKey = async (
     apiKey?: string,
   ): Promise<ContentGenerator> => {
     let userAgent: string;
     // ...mismo código extraído...
     return new LoggingContentGenerator(googleGenAI.models, gcConfig);
   };
   ```
   Ajustar dentro del helper las referencias a `config.apiKey` → `apiKey` (el
   header `Authorization: Bearer ...` y el `apiKey:` pasado a `new GoogleGenAI`).
   Las ramas de auth de Google/ADC ignoran el parámetro (no rotan).

3. **Reemplazar** el `if (USE_GEMINI || USE_VERTEX_AI || GATEWAY) { ... return ...; }`
   original por la construcción de generadores + rotación:

   ```typescript
   const rotationKeys =
     config.authType === AuthType.USE_GEMINI && config.apiKeys
       ? config.apiKeys
       : [];
   const generators: ContentGenerator[] = [];
   if (rotationKeys.length > 1) {
     for (const apiKey of rotationKeys) {
       generators.push(await buildGeneratorForApiKey(apiKey));
     }
     // USAR arrow: `map((key) => maskApiKey(key))` y NO `map(maskApiKey)`.
     // Pasando maskApiKey directo, Array.prototype.map le agrega index/array como
     // args extra y la máscara se corrompe (filtra la key completa).
     keyKeys = rotationKeys.map((key) => maskApiKey(key));
   } else {
     generators.push(await buildGeneratorForApiKey(config.apiKey));
   }
   return generators;
   ```

4. **Después del IIFE**, envolver:
   ```typescript
   const generator =
     generators.length > 1
       ? new RotatingContentGenerator(generators, keyKeys)
       : generators[0];

   if (gcConfig.recordResponses) {
     return new RecordingContentGenerator(generator, gcConfig.recordResponses);
   }
   return generator;
   ```
   Es decir, el `generator` ahora es `generators[0]` (o el rotativo); el
   `RecordingContentGenerator` sigue envolviendo afuera y `fakeResponses` quedan
   igual (no rotan, devuelven directo).

> **Resumen del flujo final:** 1 key → comportamiento idéntico al original.
> 2+ keys + USE_GEMINI → un generador por clave envuelto en `RotatingContentGenerator`.

---

## Paso 5: Verificación

1. Type-check del workspace de core:
   ```bash
   npm run typecheck --workspace @google/gemini-cli-core
   ```
   (o `npm run typecheck` completo; el lint también es obligatorio: `npm run lint`).

2. Verificación funcional con logs:
   ```bash
   export GEMINI_API_KEYS="AIza...1,AIza...2"   # 2 claves reales
   export GEMINI_DEBUG_LOG_FILE="$HOME/rotation.log"
   # Tarea multi-paso que dispare varias llamadas LLM:
   gemini --model gemini-3.5-flash --yolo -p "crea un archivo a.txt con 'hola' y b.txt con el contenido de a.txt"
   grep -a "api-key-rotation" "$HOME/rotation.log"
   ```
   Salida esperada (claves SIEMPRE enmascaradas, alternando):
   ```
   [api-key-rotation] request #1 -> apiKey[AIza***W1rY]
   [api-key-rotation] request #2 -> apiKey[AQ.A***L2Ng]
   [api-key-rotation] request #3 -> apiKey[AIza***W1rY]
   ```
   Si el log muestra las keys completas, es el bug del paso 4.3 (usaste
   `map(maskApiKey)` en lugar de arrow).

3. (Opcional) Test unitario de rotación/reintento aclarando que un error de cuota
   mueve al siguiente generador y `countTokens` no avanza el índice — patrón en
   `packages/core/src/core/rotatingContentGenerator.test.ts` del repo de referencia.

---

## Problemas conocidos que esta spec evita
- **Firma inventada**: implementar con `(prompt, systemInstruction?)` Y no respetar
  la interfaz real → `tsc` falla. Leé la interfaz antes de codear.
- **Imports desde `./contentGenerator.js`**: esos tipos viven en `@google/genai`.
- **Sin reintento de cuota**: no cumplís el objetivo 5.
- **`map(maskApiKey)` y `keyKeys` mal scoped**: filtran claves completas en el log
  o rompen el build. Usá arrow + declaración antes del IIFE.