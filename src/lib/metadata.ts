import { MetadataStringType, SceneItemData } from '@vertexvis/api-client-node';
import { vertexvis } from '@vertexvis/frame-streaming-protos';
import { DomainPropertyEntry, DomainPropertyValue } from '@vertexvis/viewer';

export interface Metadata {
  readonly partName?: string;
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

  const ps: Properties = {};
  const {
    itemId,
    itemSuppliedId,
    partRevisionId,
    partId,
    suppliedPartRevisionId: partRevSuppliedId,
  } = hit;

  if (itemId?.hex) ps[ItemIdKey] = itemId.hex;
  if (itemSuppliedId?.value) ps[ItemSuppliedIdKey] = itemSuppliedId.value;
  if (partId?.hex) ps[PartIdKey] = partId.hex;
  if (partRevisionId?.hex) ps[PartRevIdKey] = partRevisionId.hex;
  if (partRevSuppliedId?.value) ps[PartRevSuppliedId] = partRevSuppliedId.value;

  const md = hit?.metadataProperties;
  if (md) {
    md.filter((p) => p.key).forEach((p) => (ps[p.key as string] = toValue(p)));
  }

  return { partName: ps.Name, properties: alphabetize(ps) };
}

// Server-side REST path (`GET /api/scene-items/{id}` → SceneItemData) that
// IGNORES the property key policy. Used to populate the "Unrestricted" column of
// the metadata comparison so the policy-stripped keys are visible for validation.
export function toMetadataFromItem(item: SceneItemData): Metadata | undefined {
  const ps: Properties = {};
  const id = item.id;
  const suppliedId = item.attributes.suppliedId;
  const partRevisionId = item.relationships.source?.data.id;

  ps[ItemIdKey] = id;
  if (suppliedId) ps[ItemSuppliedIdKey] = suppliedId;
  if (partRevisionId) ps[PartRevIdKey] = partRevisionId;
  const md = item.attributes.metadata;

  if (md) {
    const itemMD = Object.entries(md).reduce((n, current) => {
      return {
        ...n,
        [current[0]]: (current[1] as MetadataStringType).value || '',
      };
    }, ps);

    return { partName: '', properties: alphabetize(itemMD) };
  }

  return { partName: '', properties: alphabetize(ps) };
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
  const ps: Properties = {};

  // Identifier keys are structural (not policy-restricted metadata), so we keep
  // surfacing them even under a policy to preserve parity with the prior view.
  if (identifiers?.id) ps[ItemIdKey] = identifiers.id;
  if (identifiers?.suppliedId) ps[ItemSuppliedIdKey] = identifiers.suppliedId;
  if (identifiers?.partId) ps[PartIdKey] = identifiers.partId;
  if (identifiers?.partRevisionId) ps[PartRevIdKey] = identifiers.partRevisionId;
  if (identifiers?.partRevisionSuppliedId)
    ps[PartRevSuppliedId] = identifiers.partRevisionSuppliedId;

  entries.forEach((entry) => {
    const key = entry.key?.name;
    // Preserve property keys verbatim (case-sensitive) — do not normalize.
    if (key) ps[key] = toDomainValue(entry.value);
  });

  return {
    partName: identifiers?.name ?? ps.Name,
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
