// config.example.js
//
// Template for config.js (which is gitignored). Copy this file to config.js
// ONLY if you want to test the Thunderforest basemap locally; otherwise leave
// it absent and the app uses the free CartoDB basemap by default.
//
//   cp config.example.js config.js
//
// Get your key at https://www.thunderforest.com/dashboard
// In the Thunderforest dashboard, you can't domain-lock a free key, so rely on
// rate limits (free tier is generous for personal use) and keep it out of git.
//
// NOTE: `useThunderforest` is normally set to true only by the GitHub Pages
// deploy workflow (deploy.yml), which injects its own config.js in production.
// Set it to true here ONLY for local Thunderforest testing — it will consume
// your API quota while you explore.

window.__APP_CONFIG__ = {
    useThunderforest: false,       // leave false to use the free CartoDB basemap
    thunderforestApiKey: '',       // <- paste your Thunderforest API key here
};
