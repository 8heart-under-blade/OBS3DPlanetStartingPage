# Asset Provenance & Licensing Audit

**Repository:** OBS3DPlanetStartingPage
**Branch:** `feature/production-foundation`
**Audited at commit:** `ea5fb4c866e48b9c8ba4981191437d1ff61780c6`
**Audit date:** 2026-10-11
**Machine-readable inventory:** [`asset-inventory.json`](asset-inventory.json) (schemaVersion 1)
**Summary of attributions:** [`../ATTRIBUTIONS.md`](../ATTRIBUTIONS.md)

This audit covers **bundled third-party assets only**. It does not certify runtime behavior or visual output.
It records what the bytes are, what evidence of origin/license exists *inside the repository*, and honestly
marks anything that cannot be verified. No assets were downloaded, modified, or replaced.

## Scope

Every tracked asset matching the required patterns was inventoried:

- `vendor/**`
- `textures/**`
- root `*.woff`

| Pattern | Files |
| --- | --- |
| `vendor/**` | 12 |
| `textures/**` | 6 |
| `*.woff` | 2 |
| **Total** | **20** |

First-party source files (`*.html`, `*.css`, `*.js`, `README.md`, `TY4Watching.md`) are out of scope except
that the repository's own code license (MIT, `LICENSE`, Copyright (c) 2026 8heart-under-blade) is recorded
separately in the inventory under `repositoryCode`. **The repository MIT license does not extend to the
bundled assets.**

## Result summary

| Status | Count | Meaning |
| --- | --- | --- |
| `verified` | 12 | License established by in-repo evidence (embedded notice); attribution requirements recorded. |
| `unresolved` | 8 | Asset present, but no in-repo evidence establishes license/redistribution rights. **Release blocker.** |
| **Total** | **20** | |

- All 12 `verified` assets are **Three.js** files (MIT).
- All 8 `unresolved` assets are **6 textures + 2 fonts**.

## Method

- **Hashes:** SHA-256 of each tracked file's bytes (`sha256sum` / chunked hashing), recorded per asset.
  Re-running the hashes reproduces the inventory exactly (see "Verification" below).
- **Three.js evidence:** read the embedded `@license` / `SPDX-License-Identifier: MIT` headers in the
  vendored build files.
- **Font evidence:** parsed the `.woff` `name` table directly from the files (name IDs 0, 7, 8, 9, 10, 13/14,
  55555) — this is authoritative in-file metadata, not a guess from the filename.
- **Texture evidence:** parsed PNG chunks (`tEXt`/`iTXt`/`zTXt`) and JPEG segments (APP0/APP1/APP2/APP13/APP14)
  for rights, creator, or license fields.
- **No network access was used.** Remote/CDN URLs appearing in code were treated only as leads, never as
  license evidence. (Web search was unavailable in this environment.)

## Verified assets (Three.js, MIT)

| Path | Revision | Evidence |
| --- | --- | --- |
| `vendor/three.min.js` | r160 | Embedded `Copyright 2010-2023 Three.js Authors` + `SPDX-License-Identifier: MIT` |
| `vendor/three-0.181.0/build/three.core.js` | r181 | Embedded `Copyright 2010-2025 Three.js Authors` + `SPDX-License-Identifier: MIT` |
| `vendor/three-0.181.0/build/three.module.js` | r181 | Embedded `Copyright 2010-2025 Three.js Authors` + `SPDX-License-Identifier: MIT` |
| `vendor/three-0.181.0/examples/jsm/controls/OrbitControls.js` | r181 | Covered by sibling `build/*.js` notice; no per-file header |
| `vendor/three-0.181.0/examples/jsm/postprocessing/EffectComposer.js` | r181 | same |
| `vendor/three-0.181.0/examples/jsm/postprocessing/MaskPass.js` | r181 | same |
| `vendor/three-0.181.0/examples/jsm/postprocessing/Pass.js` | r181 | same |
| `vendor/three-0.181.0/examples/jsm/postprocessing/RenderPass.js` | r181 | same |
| `vendor/three-0.181.0/examples/jsm/postprocessing/ShaderPass.js` | r181 | same |
| `vendor/three-0.181.0/examples/jsm/postprocessing/UnrealBloomPass.js` | r181 | same |
| `vendor/three-0.181.0/examples/jsm/shaders/CopyShader.js` | r181 | same |
| `vendor/three-0.181.0/examples/jsm/shaders/LuminosityHighPassShader.js` | r181 | same |

Notes and residual gaps for the verified set:

1. **Two Three.js revisions are bundled.** `vendor/three.min.js` is **r160** (classic build, Copyright
   2010-2023, carries the r150+ deprecation warning), while `vendor/three-0.181.0/` is **r181**
   (Copyright 2010-2025). Both are MIT. The directory name `three-0.181.0` reflects r181; the classic
   build is a different revision. This is a maintenance/consistency observation, not a licensing problem.
2. **No standalone Three.js `LICENSE` file is bundled** under `vendor/`. The MIT notice survives only inside
   the minified/module file headers. Attribution is currently satisfied by those in-file notices, but a
   `vendor/three-*/LICENSE` would make it robust.
3. **The 9 addon modules under `examples/jsm/` have no per-file `@license` header.** They are treated as
   `verified` MIT because they are part of the three.js r181 distribution (they import from
   `../../../build/three.module.js` and are the standard three/addons files) and the distribution notice is
   present in the sibling `build/` files. **Byte-identity to an upstream r181 tag was not checked** (offline
   audit). If strict release evidence is required, hash-compare against the upstream r181 tarball.

## Unresolved assets (release blockers)

These have NO documented redistribution license. Filenames, remote URLs in code, and the repo MIT license
are **not** accepted as evidence.

| Path | What was found | Why unresolved |
| --- | --- | --- |
| `oracles.woff` | Name table: `Copyright (c) 2016 by Heroglyphs. All rights reserved.`; `Oracles is a trademark of Heroglyphs.`; Font Squirrel webfont | Proprietary notice reserves all rights; no redistribution/embedding grant bundled |
| `twigs.woff` | Name table: `Copyright (c) 2016 by Heroglyphs. All rights reserved.`; `The Twigs is a trademark of Heroglyphs.`; Font Squirrel webfont | Same |
| `textures/planets/earth_clouds_1024.png` | No PNG text/rights metadata; code default references a `threejs.org` URL | URL is not a license; no creator/license recorded |
| `textures/planets/earth_clouds_2k_solarsystemscope.jpg` | Adobe XMP Core only; no rights fields; filename implies Solar System Scope | Origin unconfirmed; Solar System Scope's CC BY 4.0 terms (if applicable) not bundled/verified; attribution would be required |
| `textures/planets/earth_day_2048.jpg` | EXIF: GIMP 2.6.7, 2010-06-08, Photoshop `DocumentID`; no rights fields | No license/creator recorded |
| `textures/planets/earth_night_2048.png` | PNG `tEXt`: `Software: Adobe ImageReady` | No license/creator recorded |
| `textures/planets/earth_specular_2048.jpg` | Bare JFIF; no rights fields | No license/creator recorded |
| `textures/planets/moon_1024.jpg` | No metadata; code default references a `threejs.org` URL | URL is not a license; no creator/license recorded |

## Release blocker list (unresolved redistribution rights)

Redistribution rights are unresolved for the following 8 files. They must not be redistributed with a
claim of licensed reuse until provenance/license is documented:

1. `oracles.woff`
2. `twigs.woff`
3. `textures/planets/earth_clouds_1024.png`
4. `textures/planets/earth_clouds_2k_solarsystemscope.jpg`
5. `textures/planets/earth_day_2048.jpg`
6. `textures/planets/earth_night_2048.png`
7. `textures/planets/earth_specular_2048.jpg`
8. `textures/planets/moon_1024.jpg`

**This audit does not claim the blockers are solved.** It only identifies and documents them.

## Gaps and required user actions

1. **Fonts (Heroglyphs):** get the foundry's written terms for webfont embedding/redistribution, or replace
   both fonts with an explicitly open-licensed typeface (e.g. SIL OFL) and record source URL + license +
   license text. The embedded "All rights reserved" notices mean the current webfont files cannot be
   assumed redistributable.
2. **Textures:** for each image, record the exact source URL, author, and license. Likely paths:
   - NASA/GSFC public-domain imagery (record the specific page/asset), or
   - Solar System Scope CC BY 4.0 (confirm the file actually comes from there and add the required
     attribution + license link), or
   - an alternate explicitly licensed source.
   Replace any image whose terms cannot be documented. Note the current code defaults point at
   `threejs.org/examples/textures/...`; the three.js repository is MIT for its *code*, but its example
   textures have their own provenance and the URL alone does not license the bundled copy.
3. **Record evidence in-repo:** add source URL + license name + license text/notice to this repo. A license
   is only "verified" from the perspective of this audit when the evidence is contained in the repository.
4. **Keep Three.js notices:** preserve the embedded MIT headers and add a bundled `vendor/**/LICENSE`
   for durability.
5. **Update the inventory** (`docs/asset-inventory.json`) after each asset is resolved, and remove it from the
   release-blocker list.

## Verification

Re-verify the recorded hashes at any time:

```sh
# from the repository root
python3 - <<'PY'
import json, hashlib
inv = json.load(open("docs/asset-inventory.json"))
for a in inv["assets"]:
    h = hashlib.sha256(open(a["path"], "rb").read()).hexdigest()
    print("OK " if h == a["sha256"] else "MISMATCH", a["path"])
PY
```

At audit time all 20 hashes matched, the inventory covered every `vendor/**`, `textures/**`, and `*.woff`
file exactly (no missing, no extras), and every record contained
`path`, `sha256`, `status`, `source`, `license`, `evidence`, and `notes`.

## Non-claims

- No solution to the unresolved licenses is claimed.
- No visual/runtime validation was performed.
- No files were changed other than this audit's three documents
  (`ATTRIBUTIONS.md`, `docs/asset-inventory.json`, `docs/ASSET_AUDIT.md`).
