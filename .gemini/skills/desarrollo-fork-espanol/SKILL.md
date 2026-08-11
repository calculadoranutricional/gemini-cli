---
name: desarrollo-fork-espanol
description: Guía de flujo de trabajo en español para el mantenimiento de un fork, sincronización diaria con upstream y traducción de prompts/CLI al español sin generar conflictos masivos.
---

# Desarrollo de Fork y Traducción al Español

Esta habilidad proporciona el contexto necesario y las mejores prácticas para mantener tu fork del proyecto `gemini-cli` actualizado con el repositorio oficial (`upstream`) mientras realizas traducciones de prompts, comandos, habilidades y agregas nuevos modelos como `gemini-3.5-flash-lite`.

## Configuración de Remotos de Git

Para asegurar que tu fork pueda recibir actualizaciones oficiales directamente de Google, los remotos deben estar configurados de la siguiente manera:

* **`origin`**: Apunta a tu fork personal (`https://github.com/calculadoranutricional/gemini-cli.git`).
* **`upstream`**: Apunta al repositorio oficial original (`https://github.com/google-gemini/gemini-cli.git`).

Si alguna vez necesitas verificar esta configuración, puedes ejecutar:
```bash
git remote -v
```

---

## Flujo de Trabajo con Ramas (Branches)

### 1. La Regla de Oro: Nunca programes directamente en `main`
Tu rama `main` local debe mantenerse reservada **exclusivamente** para sincronizarse con el repositorio oficial de Google. Nunca realices commits o cambios directamente sobre ella.

### 2. Creación de Ramas de Trabajo
Para cada nueva característica, experimento o traducción, crea una rama independiente:
```bash
# Ejemplo para traducción
git checkout -b feature/traduccion-espanol

# Ejemplo para un nuevo modelo
git checkout -b feature/modelo-flash-lite
```

---

## Sincronización Diaria con Upstream (Frecuencia Rápida)

Para evitar acumular conflictos masivos de fusión (*merge conflicts*), debes sincronizar tu fork de manera frecuente (idealmente todos los días):

1. **Actualiza tu rama `main` local:**
   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   ```

2. **Sube los cambios actualizados a tu fork en GitHub:**
   ```bash
   git push origin main
   ```

3. **Integra las novedades en tu rama de trabajo:**
   ```bash
   git checkout feature/traduccion-espanol
   git merge main
   ```

Si realizas este ciclo de integración diariamente, los conflictos que ocurran serán mínimos y sumamente sencillos de resolver en el momento.

---

## Plan de Traducción al Español de la CLI y Prompts

Al traducir la interfaz y los prompts, sigue estas pautas de seguridad para evitar romper la lógica interna de la aplicación:

### Lo que SÍ debes traducir:
* Mensajes visibles para el usuario final en la CLI (`packages/cli/src/ui/`).
* Descripciones de comandos y textos informativos.
* Prompts de sistema (*system prompts*) que dan instrucciones de comportamiento a los agentes, **siempre que conserves intactos los placeholders y variables**.
* Documentación de habilidades (*skills*) y descripciones en la carpeta `.gemini/skills/`.

### Lo que NO debes traducir (Riesgo de errores):
* Nombres de variables internas en el código TypeScript o Python.
* Formatos o esquemas JSON y YAML esperados por la API de Gemini (como nombres de parámetros de herramientas o tipos de datos).
* Palabras clave de control específicas que los modelos esperan recibir de forma exacta (por ejemplo, identificadores de herramientas o comandos del sistema como `/compress`, `/skills reload`).

---

## Estrategia de Mitigación de Conflictos en Prompts

Dado que el equipo oficial modifica frecuentemente los prompts de sistema en inglés, mantén tus traducciones organizadas. 

Si un merge con `main` genera un conflicto en un prompt:
1. Identifica qué parte de la instrucción en inglés cambió en el repositorio oficial.
2. Integra el nuevo cambio semántico de Google traduciéndolo al español dentro de tu versión.
3. Resuelve el conflicto prefiriendo siempre tu versión en español adaptada con el cambio más reciente del upstream.
