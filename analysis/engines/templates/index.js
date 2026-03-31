'use strict';

const fs = require('fs');
const path = require('path');

// Template directory is at analysis/templates/ (project root relative)
const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates');

/**
 * Load a named HTML template from analysis/templates/.
 * @param {string} name - Template filename without extension (default: 'report')
 * @returns {string} Raw HTML template string with {{placeholder}} tokens
 */
function loadTemplate(name) {
  const file = path.join(TEMPLATE_DIR, (name || 'report') + '.html');
  return fs.readFileSync(file, 'utf8');
}

/**
 * Replace {{key}} placeholders in a template string.
 * @param {string} template - HTML string with {{placeholder}} tokens
 * @param {Object<string,string>} values - Key-value pairs to substitute
 * @returns {string} Rendered HTML
 */
function render(template, values) {
  let html = template;
  for (const [key, value] of Object.entries(values || {})) {
    html = html.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), String(value != null ? value : ''));
  }
  return html;
}

/**
 * List available template names.
 * @returns {string[]} Array of template names (without .html extension)
 */
function list() {
  return fs.readdirSync(TEMPLATE_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace(/\.html$/, ''));
}

module.exports = { loadTemplate, render, list };
