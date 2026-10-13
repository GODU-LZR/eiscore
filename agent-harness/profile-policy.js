'use strict';

const crypto = require('node:crypto');

const PROFILE_IDS = Object.freeze(['business', 'flash']);
const PROFILE_PLUGINS = Object.freeze({
  business: Object.freeze([
    'enterprise-bi', 'worker-grid', 'digital-twin', 'workflow', 'company-sales',
    'document-intake', 'engineering', 'independent-site-sales'
  ]),
  flash: Object.freeze(['flash-builder'])
});

const normalizeProfile = (value) => String(value || '').trim().toLowerCase();
const isHarnessProfile = (value) => PROFILE_IDS.includes(normalizeProfile(value));
const requireHarnessProfile = (value, name = 'HARNESS_PROFILE') => {
  const profile = normalizeProfile(value);
  if (!PROFILE_IDS.includes(profile)) {
    const error = new Error(`${name} must be one of: ${PROFILE_IDS.join(', ')}`);
    error.code = 'HARNESS_PROFILE_INVALID';
    throw error;
  }
  return profile;
};
const pluginsForProfile = (profile) => PROFILE_PLUGINS[requireHarnessProfile(profile)];
const workspaceForProfileOwner = (profile, subject, tenant) => {
  const normalizedProfile = requireHarnessProfile(profile, 'runtime profile');
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify([normalizedProfile, String(tenant || ''), String(subject || '')]))
    .digest('hex');
  return `${normalizedProfile}_ws_${digest}`;
};

module.exports = {
  PROFILE_IDS,
  PROFILE_PLUGINS,
  normalizeProfile,
  isHarnessProfile,
  requireHarnessProfile,
  pluginsForProfile,
  workspaceForProfileOwner
};
