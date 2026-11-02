# MBG's GameMaster Screen

An offline-first, single-page DM screen for 5e, built with vanilla JavaScript. It is designed for running a published adventure, but works for any 5e campaign once the SRD/5etools data is fetched locally.

**This repository contains only the tool.** It does not include 5etools game data, published adventure text, maps, or any other Wizards of the Coast content. Setup downloads the 5e data from the public 5etools mirror into an ignored local folder.

## Features

- **Party tracker** — HP, temp HP, AC, conditions, concentration, inspiration, death saves, spell slots, inventory, notes
- **Initiative runner** — rounds, turns, quick damage/heal, conditions, XP/difficulty maths, persistent dock
- **Bestiary** — fuzzy search over the monsters you fetch, CR/type/size/source filters, full statblocks
- **Compendium search** — vague, typo-tolerant search across monsters, magic items, spells, feats, rules, notes and adventure areas. Press Enter to open the first result.
- **Homebrew** — clone and edit any item, spell or monster; homebrew is searchable
- **Encounter builder** — adjusted XP, party thresholds, templates, one-click run
- **Battle map** — simple grid, draggable tokens, measuring in 5 ft squares or 5–10–5 diagonals
- **Character sheets** — a two-page A4 raven sheet with direct PDF export and print support
- **Notes** — Markdown-ish journal with folders/tags, pinning, search and Obsidian folder import
- **Adventure toolkit** — chapter reader, tarokka reading, NPC index and maps, if you import the module data yourself
- **Offline** — all assets and libraries are local; no accounts or telemetry

## Setup

Requires the **.NET 10 SDK** (for the optional local server and data builder) and PowerShell 7+.

```powershell
# 1. Fetch the 5etools JSON into tools/raw (gitignored)
powershell -ExecutionPolicy Bypass -File tools/fetch-data.ps1

# Optional: fetch the adventure player maps too (only if you own the book)
powershell -ExecutionPolicy Bypass -File tools/fetch-data.ps1 -WithMaps

# 2. Build the compact data bundles in data/ (gitignored)
dotnet run --project tools/DataBuilder -c Release

# 3. Run the local server
start.cmd
```

Open <http://localhost:5178>. On Windows, `start.cmd` also opens the browser.

You can open `index.html` directly, but use `start.cmd` for PDF export and for a consistent save origin.

### What gets downloaded

`tools/fetch-data.ps1` pulls JSON from the community 5etools mirror into `tools/raw`. `tools/DataBuilder` converts it into `data/*.js`:

- monsters from the core books and an optional published adventure
- magic items and variant items
- spells, feats, conditions, rules and the tarokka deck
- the optional published adventure chapter text

Those files are covered by the rights of their respective owners. They are deliberately excluded from this repository. If you clone the repo, run the setup steps locally and do not commit the results.

The optional `-WithMaps` flag downloads the player-facing adventure maps into `assets/maps`; those are WotC content and are also ignored by git.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl`/`⌘` + `K` | Global search / command palette |
| `Alt` + `1…0` | Jump between screens |
| `Alt` + `M` | Battle map |
| `N` / `P` | Next / previous turn |
| `/` | Focus search on the current screen |
| `D` | Dice roller |
| `?` | Shortcut help |
| `Esc` | Close drawer/modal/palette or cancel measuring |

## Project layout

```
index.html                  app shell (classic scripts, no build step)
css/                        design system, sheet and battle-map styles
js/                         state, fuzzy search, 5etools renderer, views
js/vendor/                  html2canvas + jsPDF (MIT, bundled)
data/                       generated data bundles (gitignored)
assets/fonts/               Cinzel, Inter, Cormorant Garamond (OFL)
assets/art/                 public-domain/CC0 raven artwork
assets/maps/                optional adventure player maps (gitignored)
tools/DataBuilder/          C# converter from 5etools JSON -> data/*.js
tools/Server/               tiny static file server
tools/fetch-data.ps1        downloads the 5etools JSON and optional maps
start.cmd                   start the server and open the browser
```

## Data policy

**Not in this repository:** `data/*.js` (5etools content), `tools/raw/`, `assets/maps/`, and any campaign-specific notes/characters. See `.gitignore`.

The app is built to degrade gracefully without the data: screens simply show empty states until you run the fetch/build steps.

Do not redistribute WotC content or 5etools data. The MIT license covers this project's code and original assets only.

## License

Code: **MIT** — see `LICENSE`.

Artwork and fonts: see `THIRD_PARTY_NOTICES.md` and `assets/art/CREDITS.md`.

This is an unofficial fan tool and is not affiliated with Wizards of the Coast.
