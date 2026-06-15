// SPDX-License-Identifier: AGPL-3.0-or-later

const chunkGroups = [
  {
    name: 'vue-runtime',
    packages: [
      'vue',
      'vue-router',
      'pinia',
      '@vueuse/core',
      '@vue/shared',
      '@vue/reactivity',
      '@vue/runtime-core',
      '@vue/runtime-dom',
      '@vue/compiler-core',
      '@vue/compiler-dom',
      '@vue/devtools-api'
    ]
  },
  {
    name: 'element-plus',
    packages: ['element-plus', '@element-plus/icons-vue', '@popperjs/core', 'async-validator', 'dayjs']
  },
  {
    name: 'ag-grid',
    packages: ['ag-grid-community', 'ag-grid-vue3']
  },
  {
    name: 'bpmn',
    packages: ['kthirty-bpmn-vue3']
  },
  {
    name: 'bpmn-modeler',
    packages: [
      'bpmn-js',
      'diagram-js'
    ]
  },
  {
    name: 'bpmn-moddle',
    packages: [
      'bpmn-moddle',
      '@bpmn-io/moddle-utils',
      'ids',
      'min-dash',
      'min-dom',
      'moddle',
      'moddle-xml',
      'saxen',
      'tiny-svg'
    ]
  },
  {
    name: 'charts',
    packages: ['echarts']
  },
  {
    name: 'charts-renderer',
    packages: ['zrender', 'tslib']
  },
  {
    name: 'maps-canvas',
    packages: ['css-line-break', 'html2canvas', 'konva', 'leaflet', 'rgbcolor', 'text-segmentation']
  },
  {
    name: 'documents-markdown',
    packages: [
      'argparse',
      'entities',
      'js-yaml',
      'linkify-it',
      'markdown-it',
      'mdurl',
      'uc.micro'
    ]
  },
  {
    name: 'documents-office',
    packages: [
      'cfb',
      'codepage',
      'crc-32',
      'fflate',
      'iconv-lite',
      'jszip',
      'mammoth',
      'pako',
      'ssf',
      'xlsx'
    ]
  },
  {
    name: 'diagrams-mermaid-core',
    packages: [
      '@mermaid-js/parser',
      'mermaid',
      'marked',
      'dompurify',
      'khroma',
      'stylis'
    ]
  },
  {
    name: 'diagrams-d3',
    packages: [
      'd3',
      'd3-array',
      'd3-axis',
      'd3-brush',
      'd3-chord',
      'd3-color',
      'd3-contour',
      'd3-delaunay',
      'd3-dispatch',
      'd3-drag',
      'd3-dsv',
      'd3-ease',
      'd3-fetch',
      'd3-force',
      'd3-format',
      'd3-geo',
      'd3-hierarchy',
      'd3-interpolate',
      'd3-path',
      'd3-polygon',
      'd3-quadtree',
      'd3-random',
      'd3-sankey',
      'd3-scale',
      'd3-scale-chromatic',
      'd3-selection',
      'd3-shape',
      'd3-time',
      'd3-time-format',
      'd3-timer',
      'd3-transition',
      'd3-zoom',
      'dagre-d3-es'
    ]
  },
  {
    name: 'diagrams-layout',
    packages: [
      'cytoscape',
      'cytoscape-cose-bilkent',
      'cytoscape-fcose',
      'katex',
      'roughjs'
    ]
  },
  {
    name: 'monaco',
    packages: ['monaco-editor']
  },
  {
    name: 'mobile-ui',
    packages: ['vant', '@vant/touch-emulator']
  },
  {
    name: 'micro-app',
    packages: ['qiankun', 'single-spa', 'vite-plugin-qiankun']
  },
  {
    name: 'utils',
    packages: ['axios', 'driver.js', 'lodash', 'qrcode']
  }
]

const packageToChunk = new Map(
  chunkGroups.flatMap((group) => group.packages.map((packageName) => [packageName, group.name]))
)

const getPackageName = (id) => {
  const normalized = id.replaceAll('\\', '/')
  const marker = '/node_modules/'
  const index = normalized.lastIndexOf(marker)
  if (index === -1) return null

  let packagePath = normalized.slice(index + marker.length)
  if (packagePath.startsWith('.pnpm/')) {
    const nestedIndex = packagePath.indexOf('/node_modules/')
    if (nestedIndex === -1) return null
    packagePath = packagePath.slice(nestedIndex + marker.length)
  }

  const parts = packagePath.split('/')
  if (!parts[0]) return null
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}

export const createManualChunks = () => (id) => {
  const normalized = id.replaceAll('\\', '/')
  if (normalized.includes('vite/preload-helper') || normalized.includes('commonjsHelpers')) {
    return 'runtime'
  }

  if (normalized.includes('/node_modules/echarts/')) {
    if (normalized.includes('/node_modules/echarts/charts')) return 'charts-series'
    if (normalized.includes('/node_modules/echarts/components')) return 'charts-components'
    return 'charts-core'
  }

  if (normalized.includes('/node_modules/mermaid/')) {
    if (normalized.includes('/chunks/')) return undefined
    return 'diagrams-mermaid-core'
  }

  if (normalized.includes('/node_modules/bpmn-js/')) {
    return normalized.includes('/lib/features/modeling/') ? 'bpmn-modeling' : 'bpmn-modeler'
  }

  if (normalized.includes('/node_modules/diagram-js/')) {
    return normalized.includes('/lib/features/modeling/') ? 'bpmn-modeling' : 'bpmn-diagram'
  }

  const packageName = getPackageName(id)
  if (!packageName) return undefined
  return packageToChunk.get(packageName) || 'vendor-misc'
}

const mergeRollupOptions = (baseOptions, overrides = {}) => ({
  ...baseOptions,
  ...overrides,
  output: {
    ...baseOptions.output,
    ...(overrides.output || {})
  }
})

export const createBuildOptions = (overrides = {}) => {
  const baseOptions = {
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: createManualChunks(),
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }

  return {
    ...baseOptions,
    ...overrides,
    rollupOptions: mergeRollupOptions(baseOptions.rollupOptions, overrides.rollupOptions)
  }
}
