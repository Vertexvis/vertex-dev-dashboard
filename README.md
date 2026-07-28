# Vertex Dev Dashboard

The Vertex Developer Dashboard is an application designed for managing and viewing the Scenes, Files, and the Parts Library associated to your platform account.

This dashboard is intended to be a lightweight option for managing this data, and as such, does not provide all of the functionality available through
[Vertex Connect](https://vertex3d.com/products/vertex-connect). What this dashboard does provide is an easy way to manage, track, and visually inspect the
data being brought into the Vertex Platform through a GUI. The tools provided for performing these interactions are split into focused areas. For more information on getting started with the Vertex Developer Dashboard, see the [Getting Started guide](./getting-started.md).

For our multi-tenant account, the dashboard can be found at https://dashboard.developer.vertexvis.com/. Private deployments of the Vertex Platform will also
include a custom deployment of this dashboard accessible at a URL generated as part of the initial deployment. Once this initial deployment has completed, the
URL generated will be discoverable from Route 53 in AWS, and will contain the `dev-dashboard` prefix. This dashboard will be pre-configured to work against
your private deployment.

## Local development

Prepare the project from the repository root using either option:

- Run `yarn setup` to create `.env.local`, generate its `COOKIE_SECRET`, and install dependencies.
- Or manually copy `.env.local.template` to `.env.local`, set `COOKIE_SECRET` to a random value of at least 32 characters, then run `yarn install`.

Start the app with `yarn dev`, then browse to http://localhost:3000.

## Run locally in Docker

Prepare `.env.local` using either option above, then run `docker-compose --file ./docker-compose.yml up` and browse to http://localhost:3000.

After pulling changes, run `docker-compose --file ./docker-compose.yml build` before starting the container again.

### Project organization

```text
public/       // Static assets
src/
  components/ // Components used in pages
  lib/        // Shared libraries and utilities
  pages/      // Pages served by NextJS
    api/      // API endpoints served by NextJS
```

### Deployment

A few options for deployment,

- [Vercel](https://nextjs.org/docs/deployment)
- [Netlify](https://www.netlify.com/blog/2020/11/30/how-to-deploy-next.js-sites-to-netlify/)
- [AWS CDK](https://github.com/serverless-nextjs/serverless-next.js#readme)

### Quality checks

This project uses Lefthook for pre-commit quality checks. To enable it locally, run `yarn lefthook:install`.

#### Working with git worktrees

Git stores hooks in the shared common git directory, so a few things are worth knowing if you use worktrees:

- **Enabling/disabling is repo-wide.** Running `yarn lefthook:install` (or `lefthook uninstall`) from any worktree turns the pre-commit hook on (or off) for _every_ worktree, including `main`. There is no per-worktree opt-in. Run the install from your primary checkout so the hook doesn't reference a throwaway worktree path.
- **Each worktree needs its own dependencies.** Worktrees don't share `node_modules`, and the hook runs `format:staged:check`, `lint`, `typecheck`, and `test`. Run `yarn install` in every worktree you commit from, or those commands will fail at commit time.
- **Skip the hook when needed.** Prefix a commit with `LEFTHOOK=0` (e.g. `LEFTHOOK=0 git commit ...`) to bypass the checks for a single commit.
