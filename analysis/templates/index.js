'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = __dirname;

/**
 * Load an HTML template by name (without extension).
 * @param {string} name - Template name, e.g. 'report'
 * @returns {string} Raw HTML template string with {{placeholder}} tokens
 */
function load(name) {
  var filePath = path.join(TEMPLATE_DIR, name + '.html');
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Replace {{key}} placeholders in a template string.
 * @param {string} template - HTML template with {{placeholder}} tokens
 * @param {Object} data - Key-value pairs for replacement
 * @returns {string} Rendered HTML
 */
function render(template, data) {
  var html = template;
  for (var key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      html = html.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), data[key]);
    }
  }
  return html;
}

module.exports = {
  load: load,
  render: render,
  reportTemplate: load('report'),
};
