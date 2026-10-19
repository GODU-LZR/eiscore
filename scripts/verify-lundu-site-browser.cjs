// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣
// Playwright CLI run-code function, not a standalone Node program. Use a dedicated
// session on the target origin; inject __LUNDU_RELEASE_CHECK__ before running.
// The caller saves the returned JSON. No API responses are mocked here.
async (page, suppliedConfig) => {
  const config = suppliedConfig || await page.evaluate(() => window.__LUNDU_RELEASE_CHECK__)
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  check(config && /^[a-f0-9]{16}$/i.test(config.expectedVersion), 'expectedVersion must be a manifest version')
  check(/^[a-f0-9]{64}$/i.test(config.expectedTreeSha256), 'expectedTreeSha256 must be a SHA-256')
  const origin = new URL(page.url()).origin
  check(/^https?:\/\//.test(origin), 'Open the target HTTP(S) origin before running this check')
  const errors = []
  const views = []
  const onPageError = error => errors.push(error.message)
  const onConsole = message => { if (message.type() === 'error') errors.push(`console.error: ${message.text()}`) }
  const readOnlyRoute = async route => {
    const request = route.request()
    if (!['GET', 'HEAD'].includes(request.method())) {
      errors.push(`Blocked write: ${request.method()} ${request.url()}`)
      await route.abort('blockedbyclient')
    } else {
      // Preserve the runner's static candidate/provenance routes, if installed.
      await route.fallback()
    }
  }
  const readJson = path => page.evaluate(async path => {
    const response = await fetch(path, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(30000) })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(`Public JSON unavailable: ${path} (${response.status})`)
    }
    return response.json()
  }, path)
  const verifyRelease = async () => {
    const manifest = await readJson('/asset-manifest.json')
    const provenance = await readJson('/release-provenance.json')
    check(manifest.version === config.expectedVersion, `Unexpected manifest version: ${manifest.version}`)
    check(provenance.manifestVersion === manifest.version, 'Provenance and manifest versions differ')
    check(provenance.treeSha256 === config.expectedTreeSha256, 'Release tree SHA-256 differs')
    check(/^[a-f0-9]{40}$/i.test(provenance.sourceCommit) && provenance.build?.stamp, 'Provenance source commit or build stamp is missing')
    return { version: manifest.version, treeSha256: provenance.treeSha256, sourceCommit: provenance.sourceCommit, releaseStamp: provenance.build.stamp, count: manifest.count }
  }
  const loadedImage = async locator => {
    await locator.waitFor({ state: 'visible', timeout: 20000 })
    const image = await locator.evaluate(async image => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Image decode timed out')), 15000)
        image.decode().then(resolve, reject).finally(() => clearTimeout(timer))
      })
      return {
        src: image.getAttribute('src'),
        loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
        fit: getComputedStyle(image).objectFit
      }
    })
    check(image.loaded, `Image failed to load: ${image.src}`)
    return image
  }
  const inquiryBefore = await page.evaluate(() => localStorage.getItem('lundu-inquiry-list'))
  page.on('pageerror', onPageError)
  page.on('console', onConsole)
  await page.route('**/*', readOnlyRoute)
  let release
  try {
    release = await verifyRelease()
    for (const [viewportWidth, viewportHeight] of [[1440, 900], [390, 844], [414, 896], [768, 1024]]) {
      await page.bringToFront()
      await page.setViewportSize({ width: viewportWidth, height: viewportHeight })
      // Only the isolated browser's procurement draft is changed, then restored.
      await page.evaluate(() => localStorage.removeItem('lundu-inquiry-list'))
      await page.goto(`${origin}/login?lang=zh-CN`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForFunction(() => window.__EISCORE_INITIAL_CONTENT_READY__ === true
        && document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('system')?.enterpriseProfile.source === 'published-site', null, { timeout: 90000 })
      const profile = await readJson('/agent/company-site/public/site-config?locale=zh-CN')
      check(profile.site?.status === 'published' && (profile.site.siteKey || profile.site.site_key)
        && Array.isArray(profile.content?.products) && profile.content.products.length >= 12, 'Real published public profile is missing')
      await page.locator('#eiscore-bootstrap-loading').waitFor({ state: 'hidden', timeout: 60000 })

      const pauseSlides = page.getByRole('button', { name: '暂停轮播', exact: true })
      if (await pauseSlides.count()) await pauseSlides.click()
      const tabs = page.getByRole('tablist', { name: '首屏图片', exact: true }).getByRole('tab')
      check(await tabs.count() === 6, 'Expected six slides after loading the published profile')
      const slides = []
      for (let index = 0; index < 6; index++) {
        await tabs.nth(index).click()
        await page.waitForFunction(index => document.querySelectorAll('.hero-carousel-dots [role="tab"]')[index]?.getAttribute('aria-selected') === 'true', index)
        slides.push((await loadedImage(page.locator('.hero-media > img'))).src)
      }
      check(new Set(slides).size === 6, 'Expected six distinct carousel images')

      const bom = page.locator('[data-pump-bom-viewer]')
      await bom.scrollIntoViewIfNeeded()
      await bom.locator('.pump-bom-status.is-ready').waitFor({ state: 'visible', timeout: 30000 })
      const bomParts = await bom.locator('.pump-bom-list li').count()
      check(bomParts === 13, `Expected 13 pump BOM parts, got ${bomParts}`)
      check(await bom.locator('canvas').evaluate(canvas => canvas.width > 0 && canvas.height > 0
        && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0), 'Pump canvas has no rendered dimensions')
      await bom.getByRole('button', { name: '拆分 BOM', exact: true }).click()
      await page.waitForFunction(() => {
        const node = document.querySelector('.pump-bom-progress span')
        return node && new DOMMatrix(getComputedStyle(node).transform).a > 0.99
      }, null, { timeout: 20000 })
      await bom.getByRole('button', { name: '组装 BOM', exact: true }).click()
      await page.waitForFunction(() => {
        const node = document.querySelector('.pump-bom-progress span')
        return node && new DOMMatrix(getComputedStyle(node).transform).a < 0.01
      }, null, { timeout: 20000 })

      const cards = page.locator('.public-product-card')
      check(await cards.count() === 12, 'Expected 12 public products')
      await cards.first().scrollIntoViewIfNeeded()
      await page.waitForFunction(() => {
        const section = document.querySelector('#products')
        return section?.classList.contains('is-visible') && Number(getComputedStyle(section).opacity) > 0
      }, null, { timeout: 15000 })
      const productImages = []
      const detailImages = []
      for (let index = 0; index < 12; index++) {
        const card = cards.nth(index)
        await card.scrollIntoViewIfNeeded()
        const productImage = await loadedImage(card.locator('.product-card-media img'))
        productImages.push(productImage)
        await card.getByRole('button', { name: '产品详情', exact: true }).click()
        const detail = page.locator('.product-detail-modal')
        const detailImage = await loadedImage(detail.locator('.product-detail-media img'))
        check(detailImage.src === productImage.src, `Product detail shows a different image at index ${index}`)
        detailImages.push(detailImage)
        await detail.locator('.commerce-close').click()
        await detail.waitFor({ state: 'hidden' })
        await card.getByRole('button', { name: '加入采购单', exact: true }).click()
        const quote = page.locator('.quote-modal')
        await quote.waitFor({ state: 'visible' })
        if (index === 11) {
          check(await quote.locator('.quote-line').count() === 12, 'Expected all 12 products in the local procurement draft')
        }
        if (index < 11) {
          await quote.locator('.commerce-close').click()
          await quote.waitFor({ state: 'hidden' })
        }
      }
      const quote = page.locator('.quote-modal')
      const quoteImages = []
      for (let index = 0; index < 12; index++) {
        const image = quote.locator('.quote-line-media img').nth(index)
        await image.scrollIntoViewIfNeeded()
        const loaded = await loadedImage(image)
        check(loaded.fit === 'contain', `Procurement image is cropped: ${loaded.src}`)
        check(loaded.src === productImages[index].src, `Procurement shows a different product image at index ${index}`)
        quoteImages.push(loaded)
      }
      await quote.locator('.commerce-close').click()
      await quote.waitFor({ state: 'hidden' })
      const logo = await loadedImage(page.locator('.brand-mark img'))
      const brand = await page.evaluate(async () => {
        const favicon = document.querySelector('link[rel~="icon"]')?.getAttribute('href')
        const response = favicon ? await fetch(favicon, { cache: 'no-store' }) : null
        return {
          title: document.title,
          innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          wrongBrand: /君乐缘|junleyuan/i.test(document.body.innerText),
          favicon,
          faviconStatus: response?.status,
          faviconImage: response?.headers.get('content-type')?.startsWith('image/') === true
        }
      })
      check(brand.innerWidth === viewportWidth && brand.scrollWidth <= viewportWidth, `Horizontal overflow at ${viewportWidth}: ${brand.scrollWidth}`)
      check(!brand.wrongBrand && /伦度/.test(brand.title), 'Unexpected public site brand')
      check(brand.faviconStatus === 200 && brand.faviconImage, 'Favicon is missing or returned non-image content')
      views.push({ viewportWidth, viewportHeight, realProfile: true, slides, bomParts, explodedAndAssembled: true, cards: productImages.length, loaded: productImages.filter(image => image.loaded).length, productImages, detailImages, quoteImages, logo: logo.loaded, logoImage: logo, ...brand })
      check(errors.length === 0, `Public page errors: ${errors.join('; ')}`)
    }
    const endingRelease = await verifyRelease()
    check(Object.keys(release).every(key => endingRelease[key] === release[key]), 'Release metadata changed during browser acceptance')
    return { pass: true, ...release, origin, realProfile: true, views, errors, completedAt: new Date().toISOString(), ...(config.reportPath ? { reportPath: config.reportPath } : {}) }
  } catch (error) {
    errors.push(error.message)
    error.report = { pass: false, ...release, realProfile: views.length > 0, views, errors }
    throw error
  } finally {
    page.off('pageerror', onPageError)
    page.off('console', onConsole)
    await page.unroute('**/*', readOnlyRoute)
    await page.evaluate(value => {
      if (value === null) localStorage.removeItem('lundu-inquiry-list')
      else localStorage.setItem('lundu-inquiry-list', value)
    }, inquiryBefore)
  }
}
