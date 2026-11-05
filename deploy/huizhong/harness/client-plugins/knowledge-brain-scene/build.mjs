import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
await build({
  absWorkingDir: root,
  entryPoints: ['src/brain-stage.js'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'iife',
  globalName: 'brain',
  minify: true,
  target: 'es2022',
  supported: { 'template-literal': false },
  alias: {
    'three/addons/controls/OrbitControls.js': join(root, 'vendor/OrbitControls.js'),
    three: join(root, 'vendor/three.module.min.js')
  },
  banner: { js: 'window.__ModuleLoader__.load({id:"@eiscore/dsh-client-knowledge-brain-scene",factory:()=>{' },
  footer: { js: 'return {...brain,apply(){}};}});' }
})
