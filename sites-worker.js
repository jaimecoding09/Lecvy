// Serves the built Lecvy single-page app. Deep links fall back to index.html
// via the `spa: true` flag in sites-deploy.json.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request)
  },
}
