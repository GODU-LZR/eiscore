// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '@eiscore/platform/safe-storage'

export const COMPANY_SITE_LOCALE_KEY = 'jinwei.site.locale'
export const COMPANY_SITE_USERNAME_KEY = 'jinwei.login.username'
export const CUE_DESIGN_KEY = 'eiscore.cue-builder.design.v1'
export const CUE_CONFIGURATION_KEY = `${CUE_DESIGN_KEY}.meta`
export const FACTORY_DEMO_KEY = 'eiscore.factory-demo.jly-ash-onepiece.v1'

export function createCompanySiteStorage({ storage } = {}) {
  const safeStorage = storage === undefined ? createSafeStorage() : createSafeStorage(storage)

  return Object.freeze({
    getSiteLocale: () => safeStorage.getText(COMPANY_SITE_LOCALE_KEY) || '',
    saveSiteLocale: (locale) => safeStorage.setText(COMPANY_SITE_LOCALE_KEY, locale),
    getRememberedUsername: () => safeStorage.getText(COMPANY_SITE_USERNAME_KEY) || '',
    rememberUsername: (username) => safeStorage.setText(COMPANY_SITE_USERNAME_KEY, username),
    forgetUsername: () => safeStorage.remove(COMPANY_SITE_USERNAME_KEY),
    getCueDesign: () => safeStorage.getJson(CUE_DESIGN_KEY, null),
    saveCueDesign: (design) => safeStorage.setJson(CUE_DESIGN_KEY, design),
    getCueConfiguration: () => safeStorage.getJson(CUE_CONFIGURATION_KEY, null),
    saveCueConfiguration: (configuration) => safeStorage.setJson(CUE_CONFIGURATION_KEY, configuration),
    getFactoryDemoState: () => safeStorage.getJson(FACTORY_DEMO_KEY, {}),
    saveFactoryDemoState: (state) => safeStorage.setJson(FACTORY_DEMO_KEY, state)
  })
}

const companySiteStorage = createCompanySiteStorage()

export const getSiteLocale = companySiteStorage.getSiteLocale
export const saveSiteLocale = companySiteStorage.saveSiteLocale
export const getRememberedUsername = companySiteStorage.getRememberedUsername
export const rememberUsername = companySiteStorage.rememberUsername
export const forgetUsername = companySiteStorage.forgetUsername
export const getCueDesign = companySiteStorage.getCueDesign
export const saveCueDesign = companySiteStorage.saveCueDesign
export const getCueConfiguration = companySiteStorage.getCueConfiguration
export const saveCueConfiguration = companySiteStorage.saveCueConfiguration
export const getFactoryDemoState = companySiteStorage.getFactoryDemoState
export const saveFactoryDemoState = companySiteStorage.saveFactoryDemoState
