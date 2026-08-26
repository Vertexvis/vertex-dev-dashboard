import { inferParserType, parseAsString } from 'nuqs';

import { parseAsPageIndex } from './nuqs-table-state';

export const sceneTableParsers = {
  cursor: parseAsString,
  name: parseAsString,
  page: parseAsPageIndex.withDefault(0),
  suppliedId: parseAsString,
};

export const sceneTableUrlKeys = {
  cursor: 'sceneCursor',
  name: 'sceneName',
  page: 'scenePage',
  suppliedId: 'sceneSuppliedId',
};

export type SceneTableState = inferParserType<typeof sceneTableParsers>;
