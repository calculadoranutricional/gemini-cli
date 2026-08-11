# Especificación: Automatización de Compilación de Bundles mediante GitHub Actions

Esta especificación detalla las instrucciones para que un agente de IA configure un flujo de trabajo (workflow) en GitHub Actions que automatice el empaquetado del bundle de la aplicación (`gemini-cli-bundle.zip`) y lo suba como un artefacto tras cada compilación exitosa.

> **Verificado contra v0.56**: el script raíz `bundle` existe en el `package.json`
> oficial de esa versión (`bundle: "npm run generate && ... node esbuild.config.js && ..."`),
> genera el binario `bundle/gemini.js` — el mismo `bin` declarado en el package.json.
> Si en tu versión el nombre del script cambió, ajustalo en el Paso 4.

---

## Objetivo
1. Crear un workflow de GitHub Actions que responda a eventos manuales (`workflow_dispatch`) y commits en ramas principales.
2. Instalar dependencias mediante `npm ci` y ejecutar el bundle de la aplicación utilizando `npm run bundle`.
3. Empaquetar el directorio `bundle/` resultante en un archivo zip ejecutable (`gemini-cli-bundle.zip`).
4. Subir el archivo comprimido como artefacto del flujo de trabajo (`gemini-cli-bundle`).

---

## Instrucciones Paso a Paso para el Agente

### Paso 1: Configurar el Workflow de GitHub Actions
Crear o actualizar el archivo `.github/workflows/build-bundle.yml` con la siguiente definición:
```yaml
name: 'Build Bundle'

on:
  workflow_dispatch:
  push:
    branches:
      - main
      - master
      - custom-models-integration

jobs:
  build:
    runs-on: 'ubuntu-latest'
    steps:
      - name: 'Checkout'
        uses: 'actions/checkout@v4'

      - name: 'Setup Node.js'
        uses: 'actions/setup-node@v4'
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: 'Install Dependencies'
        run: 'npm ci'

      - name: 'Build & Bundle'
        run: 'npm run bundle'

      - name: 'Create Bundle Archive'
        run: |
          cd bundle
          chmod +x gemini.js
          zip -r ../gemini-cli-bundle.zip .

      - name: 'Upload Artifact'
        uses: 'actions/upload-artifact@v4'
        with:
          name: 'gemini-cli-bundle'
          path: 'gemini-cli-bundle.zip'
```
