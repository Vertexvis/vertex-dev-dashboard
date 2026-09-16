import { MetadataStringType, SceneItemData } from '@vertexvis/api-client-node';
import { vertexvis } from '@vertexvis/frame-streaming-protos';

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

const ItemIdKey = 'VERTEX_SCENE_ITEM_ID';
const ItemSuppliedIdKey = 'VERTEX_SCENE_ITEM_SUPPLIED_ID';
const PartIdKey = 'VERTEX_PART_ID';
const PartRevIdKey = 'VERTEX_PART_REVISION_ID';
const PartRevSuppliedId = 'VERTEX_PART_REVISION_SUPPLIED_ID';

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
      ps[key] = (value as MetadataStringType).value || '';
    });
  }

  // Metadata-free items still carry intrinsic identifiers via `identifiers`.
  return {
    partName: '',
    identifiers: alphabetize(ids),
    properties: alphabetize(ps),
  };
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
  if (property.asString) return property.asString;
  if (property.asFloat) return property.asFloat.toString();
  if (property.asLong) return property.asLong.toString();
  if (property.asDate) return property.asDate.iso ?? undefined;
  return undefined;
}
