# @grayhaven/nerve-eval

## 6.2.0

### Minor Changes

- Terminal modeling lands end to end. Connectors now carry per-pin crimp terminal assignments through the DSL, the JSX layer, compile, the BOM, and every exporter, and the bundled examples specify real Molex terminals.

  Three new rules ship, bringing the catalog to 37 checks with regenerated rule docs. HK-CONN-021 requires a terminal on every wired cavity of a connector that declares removable contacts. HK-MFG-011 warns when a wire belongs to a cable but does not identify which conductor it uses. HK-ELEC-011 flags nets that reach fewer than two accessible connector pins, which makes continuity testing impossible.

  The scaffold starter now assigns a compatible crimp terminal to its PH-2 housing, so a fresh `nerve init` validates green and demonstrates terminal assignment from the first file.

  The WireViz importer preserves more of the format's compact authoring features: YAML anchors and merge keys including an external prepend or template file, named connector and cable instances such as `PLUG.J1`, ascending and descending pin ranges, pin labels plus wire label and unique color references, and explicit `mm`, `cm`, `m`, `in`, and `ft` lengths. Template definitions used only to create named instances are no longer emitted as physical parts.

### Patch Changes

- Updated dependencies
  - @grayhaven/nerve@6.2.0
