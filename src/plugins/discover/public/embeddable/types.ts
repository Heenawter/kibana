/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { ISearchSource } from '@kbn/data-plugin/common';
import { DataTableRecord } from '@kbn/discover-utils/types';
import type { DefaultEmbeddableApi } from '@kbn/embeddable-plugin/public';
import {
  EmbeddableApiContext,
  HasEditCapabilities,
  HasInPlaceLibraryTransforms,
  PublishesBlockingError,
  PublishesDataLoading,
  PublishesDataViews,
  PublishesSavedObjectId,
  PublishesUnifiedSearch,
  PublishingSubject,
  SerializedTimeRange,
  SerializedTitles,
} from '@kbn/presentation-publishing';
import { PublishesWritableTimeRange } from '@kbn/presentation-publishing/interfaces/fetch/publishes_unified_search';
import {
  SavedSearch,
  SavedSearchAttributes,
  SerializableSavedSearch,
} from '@kbn/saved-search-plugin/common/types';
import { DataTableColumnsMeta } from '@kbn/unified-data-table';
import { BehaviorSubject } from 'rxjs';
import { EDITABLE_SAVED_SEARCH_KEYS } from './constants';

export type SearchEmbeddableState = Pick<
  SerializableSavedSearch,
  typeof EDITABLE_SAVED_SEARCH_KEYS[number] | 'breakdownField' | 'viewMode'
> & {
  rows: DataTableRecord[];
  columnsMeta: DataTableColumnsMeta | undefined;
  totalHitCount: number | undefined;
};

export type SearchEmbeddableStateManager = {
  [key in keyof Required<SearchEmbeddableState>]: BehaviorSubject<SearchEmbeddableState[key]>;
} & {
  searchSource: BehaviorSubject<ISearchSource>;
};

export type SearchEmbeddableSerializedAttributes = Omit<
  SearchEmbeddableState,
  'rows' | 'columnsMeta' | 'totalHitCount' | 'searchSource'
> &
  Pick<SerializableSavedSearch, 'serializedSearchSource'>;

export type SearchEmbeddableSerializedState = SerializedTitles &
  SerializedTimeRange &
  Partial<Pick<SavedSearchAttributes, typeof EDITABLE_SAVED_SEARCH_KEYS[number]>> & {
    // by value
    attributes?: Partial<SavedSearchAttributes> & { references: SavedSearch['references'] };
    // by reference
    savedObjectId?: string;
  };

export type SearchEmbeddableRuntimeState = SearchEmbeddableSerializedAttributes &
  SerializedTitles &
  SerializedTimeRange & {
    savedObjectTitle?: string;
    savedObjectId?: string;
    savedObjectDescription?: string;
  };

export type SearchEmbeddableApi = DefaultEmbeddableApi<
  SearchEmbeddableSerializedState,
  SearchEmbeddableRuntimeState
> &
  PublishesDataViews &
  PublishesSavedObjectId &
  PublishesDataLoading &
  PublishesBlockingError &
  PublishesSavedSearch &
  PublishesDataViews &
  HasInPlaceLibraryTransforms &
  HasTimeRange &
  PublishesWritableTimeRange &
  Partial<HasEditCapabilities & PublishesSavedObjectId & PublishesUnifiedSearch> & {
    // PublishesUnifiedSearch represents the parts of the search source that should be exposed
    getStateManager: () => SearchEmbeddableStateManager; // probably not best to expose this but makes creation easier ¯\_(ツ)_/¯
  };

export interface PublishesSavedSearch {
  savedSearch$: PublishingSubject<SavedSearch>;
}

export const apiPublishesSavedSearch = (
  api: EmbeddableApiContext['embeddable']
): api is PublishesSavedSearch => {
  const embeddable = api as PublishesSavedSearch;
  return Boolean(embeddable.savedSearch$);
};

export interface HasTimeRange {
  hasTimeRange(): boolean;
}
