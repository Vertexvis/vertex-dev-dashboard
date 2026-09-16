import {
  MetadataDateType,
  MetadataFloatType,
  MetadataLongType,
  MetadataNullType,
  MetadataStringType,
  SceneItemData,
} from '@vertexvis/api-client-node';
import { vertexvis } from '@vertexvis/frame-streaming-protos';
import { DomainPropertyEntry, DomainPropertyValue } from '@vertexvis/viewer';

export interface Metadata {
  readonly partName?: string;
  // Intrinsic item identity (id, supplied id, source id). Client-injected and
  // not governed by property key policies, so kept separate from properties.
  // PLAT-9087 renders these in their own drawer table.
  readonly identifiers: Properties;
  readonly properties: Properties;
}

interface Properties {
  [key: string]: string | undefined;
}

export const ItemIdKey = 'VERTEX_SCENE_ITEM_ID';
export const ItemSuppliedIdKey = 'VERTEX_SCENE_ITEM_SUPPLIED_ID';
export const PartIdKey = 'VERTEX_PART_ID';
export const PartRevIdKey = 'VERTEX_PART_REVISION_ID';
export const PartRevSuppliedId = 'VERTEX_PART_REVISION_SUPPLIED_ID';

// Structural synthetic identifier keys. They are not policy-governed, so the
// comparison view must never flag them as removed/changed by a policy.
export const IdentifierKeys: ReadonlySet<string> = new Set([
  ItemIdKey,
  ItemSuppliedIdKey,
  PartIdKey,
  PartRevIdKey,
  PartRevSuppliedId,
]);

export function toMetadata({
  hit,
}: {
  hit?: vertexvis.protobuf.stream.IHit | null;
}): Metadata | undefined {
  if (hit == null) return;

  const ids: Properties = {};
  const {
    itemId,
    itemSuppliedId,
    partRevisionId,
    partId,
    suppliedPartRevisionId: partRevSuppliedId,
  } = hit;

  if (itemId?.hex) ids[ItemIdKey] = itemId.hex;
  if (itemSuppliedId?.value) ids[ItemSuppliedIdKey] = itemSuppliedId.value;
  if (partId?.hex) ids[PartIdKey] = partId.hex;
  if (partRevisionId?.hex) ids[PartRevIdKey] = partRevisionId.hex;
  if (partRevSuppliedId?.value) ids[PartRevSuppliedId] = partRevSuppliedId.value;

  const ps: Properties = {};
  const md = hit?.metadataProperties;
  if (md) {
    md.filter((p) => p.key).forEach((p) => (ps[p.key as string] = toValue(p)));
  }

  return {
    partName: ps.Name,
    identifiers: alphabetize(ids),
    properties: alphabetize(ps),
  };
}

// Server-side REST path (`GET /api/scene-items/{id}` → SceneItemData) that
// IGNORES the property key policy. Used to populate the "Unrestricted" column of
// the metadata comparison so the policy-stripped keys are visible for validation.
export function toMetadataFromItem(item: SceneItemData): Metadata {
  const ids: Properties = {};
  const suppliedId = item.attributes.suppliedId;
  const partRevisionId = item.relationships.source?.data.id;

  ids[ItemIdKey] = item.id;
  if (suppliedId) ids[ItemSuppliedIdKey] = suppliedId;
  if (partRevisionId) ids[PartRevIdKey] = partRevisionId;

  // Intentional: this developer drawer needs the unrestricted session metadata.
  const md = item.attributes.metadata; // NOSONAR
  const ps: Properties = {};
  if (md) {
    Object.entries(md).forEach(([key, value]) => {
      ps[key] = toRestValue(value);
    });
  }

  // Metadata-free items still carry intrinsic identifiers via `identifiers`.
  return {
    partName: '',
    identifiers: alphabetize(ids),
    properties: alphabetize(ps),
  };
}

type RestMetadataValue =
  | MetadataLongType
  | MetadataFloatType
  | MetadataDateType
  | MetadataStringType
  | MetadataNullType;

// REST values are typed (long/float/date/string/null). Stringify by presence,
// not truthiness, so a numeric 0 survives instead of collapsing to '' and
// rendering as a false "removed by policy" row against the Web SDK's "0".
function toRestValue(value: RestMetadataValue): string {
  return 'value' in value && value.value != null ? String(value.value) : '';
}

export interface DomainMetadataIdentifiers {
  readonly id?: string;
  readonly suppliedId?: string;
  readonly name?: string;
  readonly partId?: string;
  readonly partRevisionId?: string;
  readonly partRevisionSuppliedId?: string;
}

export function toMetadataFromDomainEntries(
  entries: DomainPropertyEntry[],
  identifiers?: DomainMetadataIdentifiers
): Metadata {
  const ids: Properties = {};
  const ps: Properties = {};

  // Identifier keys are structural (not policy-restricted metadata), so we keep
  // surfacing them even under a policy via the separate `identifiers` set.
  if (identifiers?.id) ids[ItemIdKey] = identifiers.id;
  if (identifiers?.suppliedId) ids[ItemSuppliedIdKey] = identifiers.suppliedId;
  if (identifiers?.partId) ids[PartIdKey] = identifiers.partId;
  if (identifiers?.partRevisionId) ids[PartRevIdKey] = identifiers.partRevisionId;
  if (identifiers?.partRevisionSuppliedId)
    ids[PartRevSuppliedId] = identifiers.partRevisionSuppliedId;

  entries.forEach((entry) => {
    const key = entry.key?.name;
    // Preserve property keys verbatim (case-sensitive) — do not normalize.
    if (key) ps[key] = toDomainValue(entry.value);
  });

  return {
    partName: identifiers?.name ?? ps.Name,
    identifiers: alphabetize(ids),
    properties: alphabetize(ps),
  };
}

function toDomainValue(value?: DomainPropertyValue | null): string | undefined {
  if (value == null) return undefined;

  switch (value.type) {
    case 'string':
      return value.value;
    case 'long':
    case 'double':
      return value.value.toString();
    case 'timestamp': {
      const seconds = value.value?.seconds ?? 0;
      const nanos = value.value?.nanos ?? 0;
      return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString();
    }
    default:
      return undefined;
  }
}

function alphabetize<T extends Record<string, unknown>>(obj: T): T {
  return Object.keys(obj)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc: T, cur: keyof T) => {
      acc[cur] = obj[cur];
      return acc;
    }, {} as T);
}

function toValue(
  property: vertexvis.protobuf.stream.IMetadataProperty
): string | undefined {
  // `MetadataProperty` value is a protobuf oneof, so unset fields are null.
  // Test for null/undefined (not truthiness) to preserve a numeric 0, which
  // would otherwise be dropped and render as a false difference vs "0".
  if (property.asString != null) return property.asString;
  if (property.asFloat != null) return property.asFloat.toString();
  if (property.asLong != null) return property.asLong.toString();
  if (property.asDate != null) return property.asDate.iso ?? undefined;
  return undefined;
}
