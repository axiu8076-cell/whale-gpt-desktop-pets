// Finder entry point for the self-contained Apple Silicon application.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const data = process.env.WHALE_MAC_TEST_HOME || path.join(os.homedir(), 'Library', 'Application Support', 'WhaleCompanion');
app.setName('WhaleCompanion');
fs.mkdirSync(data, { recursive: true, mode: 0o700 });
process.env.WHALE_HOME = data;
process.env.WHALE_STANDALONE_HOME = data;
process.env.WHALE_MAC_STANDALONE = '1';
// Finder launches must not accidentally inherit another application's API key.
delete process.env.DEEPSEEK_WHALE_API_KEY;
process.argv.push('--whale-data=' + data, '--supervised');
const config = path.join(data, 'follow-config.json');
if (!fs.existsSync(config)) fs.writeFileSync(config, JSON.stringify({ mode: 'standalone' }), { mode: 0o600 });
require('../main.cjs');
