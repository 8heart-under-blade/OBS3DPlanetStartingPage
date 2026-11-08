# Attributions and Third-Party Notices

This file records the licensing and provenance of material bundled in this repository.
It is a companion to the machine-readable inventory in [`docs/asset-inventory.json`](docs/asset-inventory.json)
and the detailed audit in [`docs/ASSET_AUDIT.md`](docs/ASSET_AUDIT.md).

> **Current asset set:** first-party code and Three.js are MIT. Earth/Moon textures are
> Solar System Scope CC BY 4.0; Cinzel Decorative and Macondo fonts are SIL OFL 1.1.
> Complete font and texture terms are bundled in docs/licenses/. This clears the
> recorded asset-rights blockers, not browser/OBS production qualification.

## 1. First-party project code

The source code authored for this project (HTML/CSS/JS) is licensed under the MIT License.
See [`LICENSE`](LICENSE).

```
MIT License

Copyright (c) 2026 8heart-under-blade
```

The repository MIT license **does not** cover the bundled third-party files listed below.
Bundling a file in this repository is not, by itself, a grant of rights to that file.

## 2. Three.js (MIT) — verified

Three.js is bundled in two revisions, both under the MIT License:

| Path | Revision | Copyright notice in file |
| --- | --- | --- |
| `vendor/three.min.js` | r160 (`build/three.min.js`, classic/minified) | `Copyright 2010-2023 Three.js Authors` |
| `vendor/three-0.181.0/build/three.core.js` | r181 (ESM) | `Copyright 2010-2025 Three.js Authors` |
| `vendor/three-0.181.0/build/three.module.js` | r181 (ESM) | `Copyright 2010-2025 Three.js Authors` |
| `vendor/three-0.181.0/examples/jsm/**` (9 addon modules) | r181 addons | conveyed by the sibling `build/*.js` notice |

Each `build/*.js` and `vendor/three.min.js` file contains an embedded header:

```
/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */
```

`vendor/three.min.js` carries the equivalent `Copyright 2010-2023 Three.js Authors` notice.

Three.js MIT License:

```
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Attribution requirement to preserve:** keep the upstream copyright notice and MIT license text
with any redistribution of the vendored Three.js files. The addon modules under
`vendor/three-0.181.0/examples/jsm/` do not carry a per-file header; they are covered by the
three.js distribution notice in `vendor/three-0.181.0/build/`. Note that no standalone Three.js
`LICENSE` file is bundled under `vendor/`.

## 3. Earth and Moon textures — CC BY 4.0

Textures by **Solar System Scope**, https://www.solarsystemscope.com/textures/,
licensed under **Creative Commons Attribution 4.0 International**:
https://creativecommons.org/licenses/by/4.0/.

- Earth day, night, clouds and Moon JPEGs are unchanged upstream bytes.
- Earth specular map was converted from TIFF to PNG; no resizing.
- Local filenames differ from upstream. Exact download URLs, upstream SHA-256
  and bundled SHA-256 are in docs/asset-inventory.json.
- No endorsement is implied.

The upstream page explicitly grants use, adaptation and sharing, including
commercially. A dated excerpt is bundled in docs/licenses/SolarSystemScope-source.txt;
full license terms are in docs/licenses/CC-BY-4.0.txt.

Keep appropriate credit, the source and license links, and the conversion notice
with redistributions and public uses. The Thanks scene has visible credit and
links to credits.html. If cropping the credit from a stream/video, provide
equivalent attribution with that stream/video.

Suggested credit:

> Earth and Moon textures by Solar System Scope
> (https://www.solarsystemscope.com/textures/), CC BY 4.0
> (https://creativecommons.org/licenses/by/4.0/).
> Specular map converted from TIFF to PNG.

## 4. Fonts — SIL Open Font License 1.1

- **Cinzel Decorative Regular** by Natanael Gama:
  unmodified upstream TTF; see docs/licenses/CinzelDecorative-OFL.txt.
- **Macondo Regular** by John Vargas Beltrán:
  unmodified upstream TTF; see docs/licenses/Macondo-OFL.txt.

Pinned google/fonts source URLs and hashes are in docs/asset-inventory.json.
The pinned upstream Macondo OFL.txt itself contains two Unicode replacement
characters in its copyright line; our bundled notice is byte-identical to that
upstream file, not a lossy local conversion. For a readable copyright statement,
the unmodified TTF's name table (name ID 0) supplies:

> Copyright (c) 1997 - 2011, John Vargas Beltran.
> (www.johnvargasbeltran.com|john.vargasbeltran@gmail.com),
> with Reserved Font Name "Macondo"

Retain each full copyright and OFL notice with redistributed font files.
The fonts are not relicensed under the root MIT license.

## 5. Historical assets

Oracles, Twigs and the unverified example textures are no longer bundled.
The unused 1k cloud map was removed. The P0 historical source hashes remain in
docs/source-baseline-p0.json for audit only; they do not grant rights to those
old files. This clearance applies to the current inventory, not old commits,
archives or cached copies.
