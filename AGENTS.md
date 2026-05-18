# Agent Instructions

- After any code changes that modify `src/`, `server.js`, `electron-main.mjs`, or other source files: push to GitHub (`git push origin main`), rebuild the installer (`npm run package`), and create a new release (`gh release create v<version> "dist-electron/PQW-Stock-Setup.exe" "dist-electron/latest.yml" "dist-electron/PQW-Stock-Setup.exe.blockmap" --title "..." --notes "..."`).
- Always bump the version in `package.json` before creating a release.
- Never commit binary files from `dist-electron/` into the git repo.
