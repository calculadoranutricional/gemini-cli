---
name: desarrollo-fork-master
description: Guía de flujo de trabajo en español para el mantenimiento de tu fork personalizado de gemini-cli en la rama master, sincronización con upstream y desarrollo de múltiples características personalizadas (modelos, workflows y traducciones) en Android/Termux.
---

# Desarrollo de Fork Personalizado en Rama Master (Android / Termux)

Esta habilidad proporciona las directrices y mejores prácticas para gestionar el desarrollo de tu fork personalizado en la rama principal de trabajo **`master`** operando desde un entorno **Android con Termux**. Te permite integrar y mantener múltiples modificaciones, tales como nuevos modelos de IA, automatización con GitHub Actions y traducciones al español.

## Configuración de Remotos de Git

Para que tu fork reciba actualizaciones oficiales de Google, los remotos se estructuran así:

* **`origin`**: Apunta a tu fork personal (`https://github.com/calculadoranutricional/gemini-cli.git`).
* **`upstream`**: Apunta al repositorio oficial de Google (`https://github.com/google-gemini/gemini-cli.git`).

---

## Particularidades del Entorno Android / Termux

Al desarrollar directamente en Termux, ten en cuenta las siguientes consideraciones:

1. **Compilación local pesada:** Las tareas de compilación y empaquetado completas (`npm run build`, `npm run bundle`) pueden requerir dependencias nativas o memoria que excedan el entorno móvil. Por ello, **apóyate fuertemente en GitHub Actions** para compilar y empaquetar automáticamente los artefactos (como `bundle.zip`) haciendo `push` a la rama `master`.
2. **Autenticación Git y GitHub CLI (`gh`):** Asegúrate de tener configurado correctamente tu usuario, correo y el helper de credenciales de GitHub (`gh auth login`) para poder realizar los comandos de `git push` sin inconvenientes.

---

## Flujo de Trabajo en la Rama `master`

Dado que tu rama de trabajo principal y desarrollo es **`master`**, el flujo para mantenerla sincronizada con el repositorio oficial sin perder tus cambios es:

1. **Actualiza tu rama local `main` con lo nuevo de Google:**
   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   ```

2. **Sube tu rama `main` actualizada a tu GitHub:**
   ```bash
   git push origin main
   ```

3. **Integra los cambios oficiales en tu rama `master`:**
   ```bash
   git checkout master
   git merge main
   ```

Realizar este proceso de forma diaria o frecuente mantendrá tu rama `master` perfectamente al día con el upstream de Google y facilitará la resolución rápida de cualquier conflicto de fusión.

---

## Tipos de Modificaciones Soportadas

Esta rama `master` aloja múltiples líneas de personalización:

### 1. Modelos Personalizados
Soporte para nuevos modelos como `gemini-3.5-flash-lite` y `gemini-3.6-flash`. Esto implica declarar su configuración técnica en los archivos de constantes y cuotas del core del proyecto (`packages/core/src/config/models.ts`, `defaultModelConfigs.ts`) y actualizar la interfaz de selección (`ModelDialog.tsx`).

### 2. Automatización con GitHub Actions (Workflows)
Archivos de flujos de trabajo personalizados en `.github/workflows/` (como `build-bundle.yml`). Éstos corren automáticamente en la nube de GitHub con cada `push` que realizas a tu rama `master`, compilando y empaquetando un `bundle.zip` listo para descargar desde las Acciones de GitHub.

### 3. Traducción al Español de la CLI y Prompts
Traducción de textos visibles y system prompts del inglés al español para facilitar tu interacción diaria, asegurando siempre no traducir variables internas ni nombres de comandos técnicos del sistema.

---

## Gestión Ágil de Conflictos

Cuando Google modifique un archivo que tú has personalizado en `master` (por ejemplo, si actualizan un prompt en inglés que tú ya tradujiste al español):
1. Git marcará conflicto al hacer `git merge main`.
2. Conserva tu lógica en español o tus configuraciones personalizadas en el archivo, e integra las nuevas adiciones o correcciones semánticas del oficial.
3. Resuelve con merges frecuentes para que los conflictos sean de pocas líneas y muy sencillos de solucionar.
