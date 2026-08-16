# Fidgetball

> Your prompt is running. Your brain is not. Here is a ball.

Sometimes Claude is thinking for four minutes straight and you must do something with your hands, or
you will alt-tab to Twitter and lose the next hour of your life.

Fidgetball hangs a ball on an elastic string from the top of your screen. It floats over everything,
ignores your clicks (except on the ball), and swings. That's it. That's the app.

## Install + run

**[⬇ Download here](https://github.com/joeinvents/FidgetBall/releases/latest)** — grab the `.exe`,
run it, you have a ball. Windows will nag with a SmartScreen popup since it's unsigned; click "more
info → run anyway" and move on.

- `Fidgetball-Setup-<version>.exe` — installer, adds it to your Start menu.
- `Fidgetball-<version>-portable.exe` — no install, just double-click and go.

Windows tested. macOS and Linux "should work (tm)".

<details>
<summary>Prefer npm?</summary>

```bash
npm install -g fidgetball
fidgetball
```

or without installing anything permanently:

```bash
npx fidgetball
```

Needs Node.js 22.12+, and the first run pulls a couple hundred MB of Electron down — so not on
hotel wifi, and not on an older Node (Electron's own installer will crash on one).

</details>

## Controls

- **Grab the ball and fling it.** It has weight. It has momentum. It has more personality than most
  standup meetings.
- **Scroll on the ball** — longer or shorter string.
- **Click the tray icon** — hide/show the ball when your manager walks past.
- **Right-click the tray icon** — reset, swing, string length, quit.
- **Everything else still works.** The overlay only takes your mouse within 54 pixels of the ball.
  Click straight through it the rest of the time.

## Tuning

Constants at the top of [`renderer/renderer.js`](renderer/renderer.js):

| Constant | What it does |
| --- | --- |
| `BALL_RADIUS` | Bigger ball |
| `GRAVITY` | Lower = moon ball |
| `COMPLIANCE` | Higher = stretchier |
| `ROPE_DAMPING` | Lower = swings forever |
| `BALL_INV_MASS` | Lower = heavier, saggier |
| `BOUNCE` | Bounciness off the screen edges |
| `MAX_SPEED` | Speed limit (it is there for a reason) |

## Roadmap

- [x] Ball
- [x] String
- [x] String that stretches

## Run from source

```bash
git clone https://github.com/joeinvents/FidgetBall.git
cd fidgetball
npm install
npm start
```

Node.js 22.12+. Electron's installer script needs a Node new enough to `require()` an ESM
dependency without choking (see the pinned `@noble/hashes` note below for the same class of bug).

## Publishing (for me, in three months, having forgotten all of this)

Two ways this reaches a human: npm, or a prebuilt binary. Both are wired up as GitHub Actions that
fire on the same trigger — push a version tag:

```bash
npm version patch          # bumps package.json, creates the v1.0.1 commit + tag
git push --follow-tags     # tag push is what triggers both workflows
```

### npm — [`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml)

Runs on `ubuntu-latest`, does `npm ci` then `npm publish`, authenticated with the `NPM_TOKEN` repo
secret (an npm **Automation** token — bypasses the 2FA/OTP prompt a normal publish would need).

One-time setup on a new machine/repo:

```bash
# 1. Create an Automation token at https://www.npmjs.com/settings/<you>/tokens
# 2. Add it as a repo secret (prompts for the value, keeps it out of shell history):
gh secret set NPM_TOKEN --repo joeinvents/FidgetBall
```

Only the files in the `files` field ship, so `node_modules` and your shame stay local. `npm pack
--dry-run` shows what would ship without publishing anything.

Electron is a real `dependency`, not a devDependency. That's the whole trick that makes
`npm install -g fidgetball` produce a working app instead of a crash. The tradeoff: the first
install pulls a couple hundred MB of Electron down before anything happens. Worth knowing before
you tell someone to `npx` it on conference wifi.

Prefer to publish by hand instead of via CI? `npm login` (once per machine; 2FA wants an OTP), then
`npm run release:patch` / `npm run release:minor` — same version-bump-and-tag dance, done locally,
which also triggers the CI workflows on push.

### Prebuilt binaries — [`.github/workflows/release.yml`](.github/workflows/release.yml)

Builds on `windows-latest`, then attaches the installers to a GitHub Release:

Two artifacts come out, both x64, both about 95 MB because Electron is Electron:

| File | What it is |
| --- | --- |
| `Fidgetball-Setup-<version>.exe` | NSIS installer, lets you pick the install directory |
| `Fidgetball-<version>-portable.exe` | Run it from anywhere, installs nothing |

You can also trigger it (or the npm publish) by hand from the Actions tab (`workflow_dispatch`) — a
manual run of `release.yml` skips the GitHub Release step and just leaves the artifacts on the run
for 30 days.

To build locally instead, `npm run dist` drops the same files in `dist/`. **It will fail on a clean
checkout**, and this is not a bug: electron-builder v26 refuses to run while `electron` sits in
`dependencies`, but it has to live there or `npx fidgetball` has no Electron to launch. The
workflow resolves this by moving it to `devDependencies` in the CI checkout right before packaging.
If you want to build locally, do the same swap, build, then put it back — do not commit the swapped
version or you'll ship a broken npm package.

No code signing, so Windows SmartScreen will call it untrusted and users get the "more info → run
anyway" dance. Fixing that costs an actual certificate.

## License

MIT. It's a ball on a string.
