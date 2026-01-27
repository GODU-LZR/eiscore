import translations from './bpmn-zh.json'

export default function customTranslate(template, replacements) {
  replacements = replacements || {}
  const text = translations[template] || template
  return text.replace(/{([^}]+)}/g, (_, key) => {
    return replacements[key] !== undefined ? replacements[key] : `{${key}}`
  })
}
