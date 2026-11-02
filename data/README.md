# data/

This folder is empty in the repository on purpose.

`tools/fetch-data.ps1` downloads the raw 5etools JSON into `tools/raw/`, then
`tools/DataBuilder` writes the generated bundles here:

- `bestiary.js`
- `items.js`
- `spells.js`
- `rules.js`
- `adventure-cos.js`
- `tarokka.js`

Those files contain game content owned by Wizards of the Coast and/or the
5etools project and are ignored by git. Do not commit them.

The app will still start without them; the Bestiary, Search and adventure
screens will simply be empty until the data is built.
