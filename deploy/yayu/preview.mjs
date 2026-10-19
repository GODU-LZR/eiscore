// SPDX-License-Identifier: AGPL-3.0-or-later
// Local website preview: deployment identity and public content, without a business API.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const base = resolve(root, 'eiscore-base')
const runtime = JSON.parse(readFileSync(new URL('./eiscore-enterprise.json', import.meta.url), 'utf8'))
runtime.endpoints.publicBaseUrl = ''
const profile = JSON.parse(readFileSync(new URL('./site-profile.json', import.meta.url), 'utf8'))
process.env.VITE_ENTERPRISE_SHARE_TITLE = profile.site.seo.title
process.env.VITE_ENTERPRISE_SHARE_DESCRIPTION = runtime.branding.login.description
process.env.VITE_ENTERPRISE_FAVICON = '/enterprise-assets/yayu/favicon.png'
const { createServer } = await import(pathToFileURL(resolve(base, 'node_modules/vite/dist/node/index.js')))
const server = await createServer({
  root: base,
  configFile: resolve(base, 'vite.config.js'),
  server: { host: '127.0.0.1', port: 18420, strictPort: true, open: false },
  plugins: [{
    name: 'deployment-website-preview',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://127.0.0.1').pathname
        let payload
        if (pathname === '/config/eiscore-enterprise.json') payload = runtime
        else if (pathname === '/agent/company-site/public/site-config') {
          payload = JSON.parse(readFileSync(new URL('./site-profile.json', import.meta.url), 'utf8'))
          payload.site.domain = '127.0.0.1'
        } else if (pathname.startsWith('/api/') || pathname.startsWith('/agent/')) {
          // Never forward a preview form or a login attempt into another tenant's services.
          const read = req.method === 'GET' || req.method === 'HEAD'
          res.statusCode = read ? 200 : 503
          payload = read ? [] : { message: '此入口用于官网预览，企业工作区请使用正式站点。' }
        } else return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(payload))
      })
    }
  }]
})
await server.listen()
server.printUrls()
