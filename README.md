# Vertex Dev Dashboard

The Vertex Developer Dashboard is an application designed for managing and viewing the Scenes, Files, and the Parts Library associated to your platform account.

This dashboard is intended to be a lightweight option for managing this data, and as such, does not provide all of the functionality available through
[Vertex Connect](https://vertex3d.com/products/vertex-connect). What this dashboard does provide is an easy way to manage, track, and visually inspect the
data being brought into the Vertex Platform through a GUI. The tools provided for performing these interactions are split into focused areas, which we'll
walk through in greater detail below.

For our multi-tenant account, the dashboard can be found at https://dashboard.developer.vertexvis.com/. Private deployments of the Vertex Platform will also
include a custom deployment of this dashboard accessible at a URL generated as part of the initial deployment. Once this initial deployment has completed, the
URL generated will be discoverable from Route 53 in AWS, and will contain the `dev-dashboard` prefix. This dashboard will be pre-configured to work against
your private deployment.

For more information on getting started with the Vertex Developer Dashboard, see the [getting started guide](./getting-started.md).

## Run locally in Docker

1. Copy `.env.local.template` to `.env.local` and optionally edit values
1. Run `docker-compose --file ./docker-compose.yml up` to start the app locally
1. Browse to http://localhost:3000

If you pull down changes, you'll need to run `docker-compose --file ./docker-compose.yml build` to build them and then `docker-compose --file ./docker-compose.yml up` again.

## Local development

1. Copy `.env.local.template` to `.env.local` and optionally edit values
1. Install dependencies, `yarn install`
1. Run `yarn dev` to start the local development server
1. Browse to http://localhost:3000

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
- [Vertex Connect](https://vertex3d.com/products/vertex-connect)
- [Vertex Platform Files](https://docs.vertex3d.com/#83fe0cae-da2d-4e3f-9c66-258bba1116ca)
