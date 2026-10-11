# Attributions and Third-Party Notices

This file records the licensing and provenance of material bundled in this repository.
It is a companion to the machine-readable inventory in [`docs/asset-inventory.json`](docs/asset-inventory.json)
and the detailed audit in [`docs/ASSET_AUDIT.md`](docs/ASSET_AUDIT.md).

> **Status of this document:** The first-party project code is MIT. Bundled **Three.js** copies are MIT and
> attributed below. The bundled **textures** and **fonts** have **no documented redistribution license** in this
> repository and are currently **unresolved release blockers**. See "Unresolved assets" below.

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

## 3. Unresolved assets (no documented license)

The following files are bundled but have **no license grant or provenance documented in this
repository**. They are treated as release blockers for redistribution. Do not assume the filename
or the repository MIT license establishes provenance or rights.

### Fonts — proprietary notices embedded

Both fonts carry embedded `.woff` name-table notices that reserve all rights:

| Path | Family | Embedded notice (from the font's own name table) |
| --- | --- | --- |
| `oracles.woff` | Oracles | `Copyright (c) 2016 by Heroglyphs. All rights reserved.` · `Oracles is a trademark of Heroglyphs.` |
| `twigs.woff` | The Twigs | `Copyright (c) 2016 by Heroglyphs. All rights reserved.` · `The Twigs is a trademark of Heroglyphs.` |

Both were converted with the Font Squirrel webfont generator (`nameID 55555 = "Font Squirrel"`).
Generating a webfont does not by itself grant redistribution or embedding rights; the foundry's
terms govern.

### Textures — no rights metadata present

| Path | Notes |
| --- | --- |
| `textures/planets/earth_clouds_1024.png` | No metadata; code default points at `threejs.org/examples/textures/...` (a URL is not a license). |
| `textures/planets/earth_clouds_2k_solarsystemscope.jpg` | Filename implies Solar System Scope; file contains only Adobe XMP toolkit metadata. |
| `textures/planets/earth_day_2048.jpg` | EXIF: GIMP 2.6.7, 2010, Photoshop `DocumentID`; no rights fields. |
| `textures/planets/earth_night_2048.png` | PNG `tEXt`: `Software: Adobe ImageReady`; no rights fields. |
| `textures/planets/earth_specular_2048.jpg` | Bare JFIF; no rights fields. |
| `textures/planets/moon_1024.jpg` | No metadata; code default points at `threejs.org/examples/textures/...` (a URL is not a license). |

## 4. How to resolve

To move an unresolved asset to **verified**, add verifiable license evidence to this repository:

- **Fonts:** obtain the foundry's (Heroglyphs) written license terms for webfont embedding/redistribution,
  or replace with a font under an explicit open license (e.g. SIL OFL) and record its source URL,
  license name, and the license text/notice.
- **Textures:** record the exact source URL, author, and license for each image (e.g. NASA public domain,
  or CC BY 4.0 with required attribution), or replace with assets whose terms are documented. For
  CC-licensed assets, retain the attribution and license notice required by that license.
- Then update `docs/asset-inventory.json` (status, source, license, evidence) and this file, and remove
  the corresponding entry from the release-blocker list.

Until then, **do not redistribute this repository's bundled assets** with any claim that they are
licensed for reuse.
