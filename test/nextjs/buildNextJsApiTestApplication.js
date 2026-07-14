const { execFileSync } = require("node:child_process");

module.exports = () => {
  execFileSync("yarn", ["build"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
};
