module.exports = {
  // Next's internal build-time lint runner is incompatible with our flat
  // ESLint config (it passes removed eslintrc-era options and no-ops).
  // Linting is enforced directly via `yarn lint` in lefthook and CI.
  eslint: { ignoreDuringBuilds: true },
  images: { domains: ["avatars.githubusercontent.com"] },
};
