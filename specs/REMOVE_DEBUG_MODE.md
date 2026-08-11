# Especificación: Eliminación del Modo Depuración (Debug Mode) y Comandos Asociados

Esta especificación detalla las instrucciones para que un agente de IA elimine por completo la opción de línea de comandos `--debug`, el comando `/debug`, y toda la lógica asociada al modo depuración interactivo en Gemini CLI.

---

## Objetivo
1. Eliminar la opción de entrada `--debug` en la configuración de argumentos del CLI (`packages/cli/src/config/config.ts`).
2. Simplificar la función de verificación `isDebugMode` para que retorne siempre `false`, previniendo la inicialización de flujos de depuración interactivos.
3. Remover el comando interno interactivo `debugCommand` (`/debug`) de la lista de comandos disponibles.
4. Ajustar y limpiar los loaders y pruebas para excluir la lógica del comando `/debug`.

---

## Instrucciones Paso a Paso para el Agente

### Paso 1: Remover la Opción `--debug` de Yargs
En `packages/cli/src/config/config.ts`, eliminar la definición de la opción interactiva `debug`:
```typescript
// Eliminar el encadenamiento de la opción debug en el parser de yargs:
// .option('debug', {
//   type: 'boolean',
//   description: 'Run in debug mode (open debug console with F12)',
// })
```

### Paso 2: Forzar `isDebugMode` a Falso
En `packages/cli/src/config/config.ts`, simplificar la función `isDebugMode` para desactivar el modo debug de forma permanente:
```typescript
export function isDebugMode(argv: CliArgs): boolean {
  void argv;
  return false;
}
```
> En v0.56, `isDebugMode` además lee env (`argv.debug || [process.env['DEBUG'],
> process.env['DEBUG_MODE']].some(...)`). Al forzar `false` quedan cubiertos ambos.
> Verificá con `grep -rn "argv.debug\|isDebugMode(" packages/cli/src` que no quede
> otro consumidor que dependa del flag para lógica distinta de la consola de debug.

### Paso 3: Eliminar el Comando Interno `debugCommand`
En `packages/cli/src/ui/commands/chatCommand.ts`, eliminar por completo la definición y exportación de `debugCommand`:
```typescript
// Remover el bloque correspondiente a:
// export const debugCommand: SlashCommand = {
//   name: 'debug',
//   ...
// };
```

### Paso 4: Quitar la Carga de `debugCommand` en el Loader de Comandos
En `packages/cli/src/services/BuiltinCommandLoader.ts`, eliminar la importación de `debugCommand` y remover su adición en la lista de comandos (`allDefinitions`):
```typescript
// Eliminar:
// import { chatCommand, debugCommand } from '../ui/commands/chatCommand.js';
// Importar únicamente chatCommand:
import { chatCommand } from '../ui/commands/chatCommand.js';
```
Y en la lista de definiciones:
```typescript
// Remover la inclusión condicional o directa de debugCommand
```

### Paso 5: Actualizar Pruebas Relacionadas
Eliminar los bloques de prueba de `/debug` y del modo debug en:
- `packages/cli/src/ui/commands/chatCommand.test.ts`
- `packages/cli/src/services/BuiltinCommandLoader.test.ts`
- `packages/cli/src/config/config.test.ts`
