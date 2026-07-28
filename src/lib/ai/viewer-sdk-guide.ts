/**
 * A compact, provider-safe description of the installed Viewer SDK (0.24.x).
 * Keep this aligned with the browser bridge; it is intentionally not a raw SDK
 * command surface.
 */
export const ViewerSdkGuide = `
VERTEX VIEWER SDK CAPABILITY GUIDE

Use RootQuery selectors in this precedence order. Never use metadata when a
more direct selector fits the request:
1. Current selection: withSelected() for “selected”, “these”, or “this part”.
2. Visibility: withVisible() for “visible parts”.
3. Known IDs: withItemId(s) and withSuppliedId(s).
4. Tree rows: withSceneTreeRange({start,end}) when the UI supplies a range.
5. Screen interaction: withPoint(x,y) or withVolumeIntersection(rectangle,
   exclusive) only when the UI supplies click/drag coordinates.
6. Metadata: withMetadata(filter, keys, false). It is partial-match only.

RootQuery can also select all(), not(), and combine compatible queries with
and()/or(). Do not invent IDs, tree ranges, screen coordinates, rendition IDs,
or representation IDs. Ask the user when those are needed.

Scene item operations: show, hide, select, deselect, setPhantom,
clearPhantom, materialOverride, clearMaterialOverrides, transform,
clearTransforms, setEndItem, clearEndItem, viewRenditionById,
viewRenditionBySuppliedId, viewDefaultRendition, clearRendition,
viewRepresentation, and clearRepresentation.

Camera: focus a known item ID or a bounding box for the active selection.
Reset: reset camera, overrides, or both. Transforms need deterministic
application code; never fabricate a 4x4 matrix. Exploded views require a
resolved item set and deterministic, bounded translations.

Scene tree: fetchMetadataKeys() returns the metadata keys available in the
current scene; filtering/paging/tree ranges are UI context, not facts to infer.

Only emit the semantic tools provided to you. Never emit JavaScript, protobuf,
raw SDK method names, credentials, or unsupported operations.

COMPOUND SCENE OPERATIONS
Some intents require an atomic transaction containing multiple item operations.
“Show only <target>” must hide all() and show the resolved target in the same
execute() call; do not approximate it with a single show. “Show only selected”
is all().hide() plus withSelected().show(); “show only item” is all().hide()
plus withItemIds([id]).show(). Selection inversion is all().deselect() plus
not().withSelected().select() in one execute() call.
`;
