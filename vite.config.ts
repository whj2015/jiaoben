import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import type { Plugin, Rollup } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const manifestJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'manifest.json'), 'utf-8'));
manifestJson.version = packageJson.version;

const updateManifestPlugin = (): Plugin => ({
  name: 'update-manifest-version',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'manifest.json',
      source: JSON.stringify(manifestJson, null, 2)
    });
  }
});

const inlineBackgroundDeps = (): Plugin => ({
  name: 'inline-background-deps',
  enforce: 'post',
  generateBundle(_options: Rollup.NormalizedOutputOptions, bundle: Rollup.OutputBundle) {
    const backgroundChunk = bundle['assets/background.js'];
    if (!backgroundChunk || backgroundChunk.type !== 'chunk') return;
    
    const imports = [...(backgroundChunk.imports || [])];
    if (imports.length === 0) return;
    
    let combinedCode = '';
    const chunksToInline: string[] = [];
    
    for (const importName of imports) {
      const importedChunk = bundle[importName];
      if (importedChunk && importedChunk.type === 'chunk') {
        let importedCode = importedChunk.code;
        
        const exportMap: Record<string, string> = {};
        const exportMatch = importedCode.match(/export\s*\{([^}]+)\}/);
        if (exportMatch) {
          const exports = exportMatch[1].split(',').map((e: string) => e.trim());
          for (const exp of exports) {
            const parts = exp.split(/\s+as\s+/);
            if (parts.length === 2) {
              exportMap[parts[1].trim()] = parts[0].trim();
            } else {
              exportMap[exp] = exp;
            }
          }
        }
        
        importedCode = importedCode.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
        importedCode = importedCode.replace(/export\s*\{[^}]*\};?/g, '');
        
        const globalAssignments = Object.entries(exportMap)
          .map(([exportName, localName]) => `globalThis.__eg_${exportName}=${localName};`)
          .join('');
        
        combinedCode += `(function(){${importedCode}${globalAssignments}})();\n`;
        chunksToInline.push(importName);
      }
    }
    
    let bgCode = backgroundChunk.code;
    
    const importMatches = bgCode.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g);
    for (const match of importMatches) {
      const imports = match[1].split(',').map((e: string) => e.trim());
      const replacements: string[] = [];
      for (const imp of imports) {
        const parts = imp.split(/\s+as\s+/);
        if (parts.length === 2) {
          const localName = parts[0].trim();
          const alias = parts[1].trim();
          replacements.push(`const ${alias}=globalThis.__eg_${localName}`);
        } else {
          replacements.push(`const ${imp}=globalThis.__eg_${imp}`);
        }
      }
      bgCode = bgCode.replace(match[0], replacements.join(';') + ';');
    }
    
    combinedCode += bgCode;
    
    combinedCode = combinedCode.replace(/import\s+[^;]+\s+from\s*['"][^'"]+['"];\s*/g, '');
    combinedCode = combinedCode.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
    combinedCode = combinedCode.replace(/export\s*\{[^}]*\};?/g, '');
    
    backgroundChunk.code = combinedCode;
    backgroundChunk.imports = [];
    backgroundChunk.dynamicImports = [];
    
    for (const chunkName of chunksToInline) {
      const isUsedByOthers = Object.values(bundle).some((chunk: Rollup.OutputAsset | Rollup.OutputChunk) => {
        if (chunk.type === 'chunk' && chunk.fileName !== 'assets/background.js') {
          return chunk.imports?.includes(chunkName);
        }
        return false;
      });
      
      if (!isUsedByOthers) {
        delete bundle[chunkName];
      }
    }
  }
});

export default defineConfig({
  plugins: [
    react(),
    updateManifestPlugin(),
    viteStaticCopy({
      targets: [
        { src: 'metadata.json', dest: '.' },
        { src: 'icons/*', dest: 'icons' },
        { src: '_locales/**/*', dest: '_locales' }
      ]
    }),
    inlineBackgroundDeps()
  ],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'index.html'),
        background: path.resolve(__dirname, 'background.ts'),
        content: path.resolve(__dirname, 'content.ts')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
