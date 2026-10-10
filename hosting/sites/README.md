# Sites hosting adapter

This folder is a source overlay for the official **Sites Vinext starter**. The main Unlikely frontend remains on GitHub Pages and has no dependency on this framework. The gateway core in `../../trial/` is standard Request/Response JavaScript with a D1 binding and can be adapted to other Cloudflare hosts.

1. Prepare a separate checkout using the Sites plugin's `project-setup.mjs` (default Vinext starter), then install its dependencies using the plugin's `install-dependencies.mjs`.
2. From the Unlikely repository run `node scripts/sync-trial-host.mjs /absolute/path/to/the-sites-checkout`. This copies the adapter, core modules and migrations, preserves the checkout's Site identity, and sets the D1 binding to `DB`.
3. Register the checkout with Sites if it has no project ID. Keep the starter's Sites build integration. Use the supported Sites source/build/deploy workflow; migrations are applied at deploy, never in request handlers.
4. Configure the runtime variables in [the public-trial guide](../../docs/public-trial.md). Leave `TRIAL_ENABLED=false` and budget `0` until credentials, budget, pricing and live verification are ready. Secrets belong in runtime configuration, never the hosting manifest.
5. Set the frontend's `TRIAL_API_BASE_URL` to the deployed public Site origin. The gateway origin must be public for anonymous use; only explicitly allowed frontend origins receive CORS access.

These files are the actual deployed adapter sources. `trial/` and the shared model protocol remain canonical in the repository root; run the sync command after changes. The stock starter and its dependency lockfile are supplied by the Sites plugin, not duplicated here. To reproduce the initial adapter build: Vinext `1.0.0-beta.5`, React `19.2.6`, Vite `8.0.13`, Wrangler `4.92.0`. See the installed starter lockfile for the complete dependency graph.

The home page is only a status page. It has no credential-entry form. `/api/trial/status` never calls a model; `/api/trial` is the only model-operation route. Both use the same reviewed gateway handler and noindex responses.
