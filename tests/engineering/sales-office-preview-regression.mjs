import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const fileDialog = read('shared/eis-data-grid-v2/components/FileDialog.vue')
const gridCore = read('shared/eis-data-grid-v2/composables/useGridCore.js')
const salesApps = read('eiscore-sales/src/utils/sales-apps.js')
const officePreview = read('eiscore-sales/src/utils/office-preview.js')

assert.match(salesApps, /officePreviewLoader:\s*loadSalesOfficePreview/)
assert.match(gridCore, /extraColDef\.officePreviewLoader\s*=\s*col\.officePreviewLoader/)
assert.match(fileDialog, /officePreviewLoader/)
assert.match(fileDialog, /officePreview\??\.kind === 'text'/)
assert.match(fileDialog, /officePreview\??\.kind === 'table'/)
assert.match(officePreview, /import\('mammoth'\)/)
assert.match(officePreview, /import\('xlsx'\)/)
assert.match(fileDialog, /fetch\('\/agent\/ai\/harness\/files\/upload'/)

console.log('PASS: Yayu customer reference files use binary upload and sales-scoped DOCX/XLSX previews')
