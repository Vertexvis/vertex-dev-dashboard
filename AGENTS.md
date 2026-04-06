# AGENTS.md

This project is the front-end for the Platform. It allows for management of
Platform concepts using Platform APIs.

## Project Structure

* `src/components`: React components that are used on pages.
* `src/lib`: Libraries to manage state and other helpers.
* `src/pages`: The pages hosted by the application.

## Technologies

* Project is written in Typescript
* Uses NextJS for hosting pages and serving API requests

## Tools

Tools to manage the project and verify changes. Run formatting and linting after
making changes. Fix any issues that are reported by these tools.

* `yarn install` to install NPM packages.
* `yarn build` to build the project
* `yarn clean` to delete the build and Node modules.
* `yarn format` to format source files.
* `yarn lint` to verify files pass linting.
* `yarn dev` to start the dev server.
* `yarn start` to start the prod server.

## Dev Server

When starting a dev server, create a `.env.local` file from
`.env.local.template`. Populate the following variables:

* `COOKIE_SECRET`: A long random string.
