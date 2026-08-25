# 3D Configurator Research Evidence

Captured: 2026-08-13  
Purpose: establish vocabulary, configuration dimensions, technical constraints and license boundaries. These sources are research evidence, not copied product art.

## Source policy

- Manufacturer pages are used only to understand component names, configuration dimensions and publicly stated engineering concepts.
- CC0 libraries are candidates for generic material/HDRI work only after recording the exact asset page, version and hash.
- A source page does not authorize copying its photographs, logos, product geometry, trade dress or proprietary art.
- A missing or ambiguous commercial license blocks an asset from `assets/web` and from production builds.

## Evidence table

| source_id | source | Evidence captured | Use in project | Status |
| --- | --- | --- | --- | --- |
| SRC-MFG-MCDERMOTT-20260813 | https://www.mcdermottcue.com/mcdermott_custom_build_cue.php | Custom dimensions include stain/paint, wrap, joint, engraving, weight and tip diameter | Vocabulary and step design only | research_only |
| SRC-MFG-MEUCCI-20260813 | https://www.meuccicues.com/pages/faq | Public manufacturing description names forearm, handle, butt sleeve, splicing, inlay, wrapping and finishing | Manufacturing vocabulary only | research_only |
| SRC-MFG-PREDATOR-20260813 | https://int.predatorcues.com/pages/predator-technology | Public technology page distinguishes shaft, carbon-fiber composite, butt construction, weight system and tip technology | Compatibility vocabulary only; no brand assets | research_only |
| SRC-MFG-CUETEC-20260813 | https://www.cuetec.com/avid/ | Public AVID page describes composite + hard maple shaft, ferrule, tip diameter choices, weight cartridge and extension-compatible bumper | Shaft/weight/extension vocabulary only | research_only |
| SRC-MFG-OLHAUSEN-20260813 | https://www.olhausenbilliards.com/olhausen-difference | Public table page names cushion, slate, frame, rail and wood dimensions/quality concerns | Future Table Studio vocabulary only | research_only |
| SRC-CC0-POLYHAVEN-20260813 | https://polyhaven.com/license | Official license page states Poly Haven assets are CC0 and may be used commercially and redistributed; website metadata/thumbnails remain separate | Generic material/HDRI candidates after exact asset capture | candidate |
| SRC-CC0-AMBIENTCG-20260813 | https://docs.ambientcg.com/license/ | Official license page states downloadable assets and preview renders are CC0 1.0 and allow commercial copying/modification/distribution | Generic PBR candidates after exact asset capture | candidate |
| SRC-MODEL-SKETCHFAB-20260813 | https://sketchfab.com/licenses | License must be checked per model; automated page verification was unavailable during capture | No asset can enter production without per-asset license snapshot | blocked |
| SRC-TECH-THREE-GLTFLOADER-20260813 | https://threejs.org/docs/pages/GLTFLoader.html | GLTFLoader supports glTF 2.0, Draco, Meshopt and KTX2/Basis extensions via loaders | Web delivery implementation reference | approved_reference |
| SRC-TECH-KHRONOS-GLTF-20260813 | https://www.khronos.org/gltf/ | glTF is an open, efficient runtime delivery format; GLB can package a scene and its resources | Formal asset format direction | approved_reference |
| SRC-TECH-KHRONOS-PBR-20260813 | https://www.khronos.org/gltf/pbr | PBR vocabulary includes base color, metallic, roughness, normal, clearcoat and related material properties | Material schema and QA vocabulary | approved_reference |
| SRC-SUPPLIER-JLY-20260813 | local supplier/factory material and CAD authorization package | Company-specific wood, wrap, CAD and product references are the preferred long-term source | Requires written authorization and exact file manifest | blocked |

## Industry-to-schema translation

| Research vocabulary | Initial schema slot | Must be confirmed by engineering |
| --- | --- | --- |
| tip / ferrule | `TIP`, `FERRULE` | diameter, hardness, length, material, supplier SKU |
| shaft | `SHAFT` | material, taper, tip diameter, joint family, length |
| joint / collar | `JOINT` | pin family, collar material, mating constraints |
| forearm / points / inlays | `FOREARM` | wood species, geometry, legal art/brand boundaries |
| handle / wrap | `HANDLE`, `WRAP` | wrap zone length, finish compatibility, material availability |
| butt sleeve / butt plate | `BUTT_SLEEVE`, `BUTT_PLATE` | dimensions, ring/inlay process, finish |
| weight system / bumper / extension | `WEIGHT_SYSTEM`, `BUMPER`, `EXTENSION_INTERFACE` | achievable weight range, interface family and country/service constraints |

## Search result decision

The first prototype uses no downloaded external assets. It uses a parameterized cue and generated swatch materials so the interaction, Design JSON, validation, pricing and BOM compiler can be tested without a copyright or provenance shortcut. The first formal asset pack should be sourced from factory-owned scans/CAD with a written commercial-use authorization; CC0 assets are suitable for generic environment and test materials, not for representing the company's actual products.
