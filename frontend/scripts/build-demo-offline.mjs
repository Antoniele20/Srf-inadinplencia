// Gera uma versão de DEMONSTRAÇÃO em um único arquivo HTML (dist-demo/index.html).
// Ele abre com duplo clique, sem servidor, sem internet e sem banco: os dados são fictícios e
// ficam no navegador de quem abre. Serve para apresentar o sistema e para conferir a interface.
//
// Uso:  npm run build:offline
//
// O build normal de produção continua sendo `npm run build` (Vite).

import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const saida = join(raiz, 'dist-demo');
mkdirSync(saida, { recursive: true });

// Permite apontar para outra pasta de módulos (ex.: ambientes sem npm install na pasta do projeto).
const nodePaths = process.env.NODE_PATH_EXTRA ? process.env.NODE_PATH_EXTRA.split(':') : [];

const resultado = await build({
  entryPoints: [join(raiz, 'src/main.jsx')],
  bundle: true,
  write: false,
  outdir: saida,
  format: 'iife',
  target: 'es2020',
  minify: true,
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  nodePaths,
  define: {
    'import.meta.env.VITE_DEMO': '"true"',
    'import.meta.env.VITE_API_URL': '""',
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'warning',
});

const js = resultado.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = resultado.outputFiles.find((f) => f.path.endsWith('.css')).text;

// "</script" dentro do JavaScript fecharia a tag antes da hora.
const jsSeguro = js.replace(/<\/script/gi, '<\\/script');

const modelo = readFileSync(join(raiz, 'index.html'), 'utf8');
// Funções no lugar de textos: o JavaScript minificado contém "$&" e "$'", que replace() interpretaria.
const html = modelo
  .replace('</head>', () => `<style>${css}</style>\n  </head>`)
  .replace(/<script type="module" src="\/src\/main.jsx"><\/script>/, () => `<script>${jsSeguro}</script>`);

writeFileSync(join(saida, 'index.html'), html, 'utf8');
console.log(`dist-demo/index.html gerado (${Math.round(html.length / 1024)} KB).`);
