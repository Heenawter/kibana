/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { pick } from 'lodash';
import deepEqual from 'react-fast-compare';
import { BehaviorSubject, combineLatest, debounceTime, Observable, skip, switchMap } from 'rxjs';

import { ISearchSource, SerializedSearchSourceFields } from '@kbn/data-plugin/common';
import { DataView } from '@kbn/data-views-plugin/common';
import { ROW_HEIGHT_OPTION, SAMPLE_SIZE_SETTING } from '@kbn/discover-utils';
import { DataTableRecord } from '@kbn/discover-utils/types';
import { AggregateQuery } from '@kbn/es-query';
import type { PublishesDataViews, StateComparators } from '@kbn/presentation-publishing';
import { SavedSearch } from '@kbn/saved-search-plugin/common';
import { SortOrder, VIEW_MODE } from '@kbn/saved-search-plugin/public';
import { DataTableColumnsMeta } from '@kbn/unified-data-table';

import { getDefaultRowsPerPage } from '../../common/constants';
import { getEsqlDataView } from '../application/main/state_management/utils/get_esql_data_view';
import { DiscoverServices } from '../build_services';
import { DEFAULT_HEADER_ROW_HEIGHT_LINES, EDITABLE_SAVED_SEARCH_KEYS } from './constants';
import { isEsqlMode } from './initialize_fetch';
import {
  PublishesSavedSearch,
  SearchEmbeddableRuntimeState,
  SearchEmbeddableSerializedAttributes,
  SearchEmbeddableStateManager,
} from './types';

const initializeSearchSource = async (
  dataService: DiscoverServices['data'],
  serializedSearchSource?: SerializedSearchSourceFields
) => {
  const [searchSource, parentSearchSource] = await Promise.all([
    dataService.search.searchSource.create(serializedSearchSource),
    dataService.search.searchSource.create(),
  ]);
  searchSource.setParent(parentSearchSource);
  const dataView = searchSource.getField('index');
  return { searchSource, dataView };
};

const initializedSavedSearch = (
  stateManager: SearchEmbeddableStateManager,
  searchSource: ISearchSource
): SavedSearch => {
  return {
    ...Object.keys(stateManager).reduce((prev, key) => {
      return {
        ...prev,
        [key]: stateManager[key as keyof SearchEmbeddableStateManager].getValue(),
      };
    }, {} as SavedSearch),
    searchSource,
  };
};

export const initializeSearchEmbeddableApi = async (
  initialState: SearchEmbeddableRuntimeState,
  {
    discoverServices,
  }: {
    discoverServices: DiscoverServices;
  }
): Promise<{
  api: PublishesSavedSearch & PublishesDataViews;
  stateManager: SearchEmbeddableStateManager;
  comparators: StateComparators<SearchEmbeddableSerializedAttributes>;
  cleanup: () => void;
}> => {
  const serializedSearchSource$ = new BehaviorSubject(initialState.serializedSearchSource);
  /** We **must** have a search source, so start by initializing it  */
  const { searchSource, dataView } = await initializeSearchSource(
    discoverServices.data,
    initialState.serializedSearchSource
  );
  const searchSource$ = new BehaviorSubject<ISearchSource>(searchSource);
  const dataViews = new BehaviorSubject<DataView[] | undefined>(dataView ? [dataView] : undefined);

  /** This is the state that can be initialized from the saved initial state */
  const columns$ = new BehaviorSubject<string[] | undefined>(initialState.columns);
  const rowHeight$ = new BehaviorSubject<number | undefined>(initialState.rowHeight);
  const rowsPerPage$ = new BehaviorSubject<number | undefined>(initialState.rowsPerPage);
  const headerRowHeight$ = new BehaviorSubject<number | undefined>(initialState.headerRowHeight);
  const sort$ = new BehaviorSubject<SortOrder[] | undefined>(initialState.sort);
  const sampleSize$ = new BehaviorSubject<number | undefined>(initialState.sampleSize);
  const breakdownField$ = new BehaviorSubject<string | undefined>(initialState.breakdownField);
  const savedSearchViewMode$ = new BehaviorSubject<VIEW_MODE | undefined>(initialState.viewMode);

  /** This is the state that has to be fetched */
  const rows$ = new BehaviorSubject<DataTableRecord[]>([]);
  const columnsMeta$ = new BehaviorSubject<DataTableColumnsMeta | undefined>(undefined);
  const totalHitCount$ = new BehaviorSubject<number | undefined>(undefined);

  const defaultRowHeight = discoverServices.uiSettings.get(ROW_HEIGHT_OPTION);
  const defaultRowsPerPage = getDefaultRowsPerPage(discoverServices.uiSettings);
  const defaultSampleSize = discoverServices.uiSettings.get(SAMPLE_SIZE_SETTING);

  /**
   * The state manager is used to modify the state of the saved search - this should never be
   * treated as the source of truth
   */
  const stateManager: SearchEmbeddableStateManager = {
    breakdownField: breakdownField$,
    columns: columns$,
    columnsMeta: columnsMeta$,
    headerRowHeight: headerRowHeight$,
    rows: rows$,
    rowHeight: rowHeight$,
    rowsPerPage: rowsPerPage$,
    sampleSize: sampleSize$,
    sort: sort$,
    totalHitCount: totalHitCount$,
    viewMode: savedSearchViewMode$,
    searchSource: searchSource$,
  };

  /** The saved search should be the source of truth for all state  */
  const savedSearch$ = new BehaviorSubject(initializedSavedSearch(stateManager, searchSource));

  /** This will fire when any of the **editable** state changes */
  const onAnyStateChange: Observable<Partial<SavedSearch>> = combineLatest(
    pick(stateManager, EDITABLE_SAVED_SEARCH_KEYS)
  );

  /** Keep the saved search in sync with any state changes */
  const syncSavedSearch = combineLatest([onAnyStateChange, serializedSearchSource$])
    .pipe(
      skip(1),
      switchMap(
        async ([partialSavedSearch, serializedSearchSource]): Promise<{
          savedSearch: SavedSearch;
          dataView?: DataView;
        }> => {
          const newSearchSearchSource = await discoverServices.data.search.searchSource.create(
            serializedSearchSource
          );
          const newSavedSearch: SavedSearch = {
            ...savedSearch$.getValue(),
            ...partialSavedSearch,
            searchSource: newSearchSearchSource,
          };
          if (isEsqlMode(newSavedSearch)) {
            const currentDataView = newSearchSearchSource.getField('index');
            const query = newSearchSearchSource.getField('query') as AggregateQuery;
            const nextDataView = await getEsqlDataView(query, currentDataView, discoverServices);
            return { savedSearch: newSavedSearch, dataView: nextDataView };
          }
          return { savedSearch: newSavedSearch };
        }
      ),
      debounceTime(1)
    )
    .subscribe(({ savedSearch: newSavedSearch, dataView: newDataView }) => {
      if (newDataView) {
        newSavedSearch.searchSource.setField('index', newDataView);
      }
      savedSearch$.next(newSavedSearch);
    });

  const syncDataView = dataViews.pipe(skip(1)).subscribe((newDataViews) => {
    if (!(newDataViews ?? []).length) return;
    const newDataView = newDataViews![0];
    searchSource$.next(searchSource$.getValue().setField('index', newDataView));
  });

  const syncSerializedSearchSource = searchSource$
    .pipe(skip(1), debounceTime(60))
    .subscribe(async (newSearchSource) => {
      serializedSearchSource$.next(newSearchSource.getSerializedFields());
    });

  return {
    cleanup: () => {
      syncSavedSearch.unsubscribe();
      syncDataView.unsubscribe();
      syncSerializedSearchSource.unsubscribe();
    },
    api: {
      dataViews,
      savedSearch$,
    },
    stateManager,
    comparators: {
      serializedSearchSource: [
        serializedSearchSource$,
        (value) => serializedSearchSource$.next(value),
        (a, b) => deepEqual(a, b),
      ],
      viewMode: [
        savedSearchViewMode$,
        (value) => {
          return; // the view mode can't currently be changed from dashboard, so the setter is not necessary
        },
      ],
      breakdownField: [breakdownField$, (value) => breakdownField$.next(value)],
      sort: [sort$, (value) => sort$.next(value), (a, b) => deepEqual(a, b)],
      columns: [columns$, (value) => columns$.next(value), (a, b) => deepEqual(a, b)],
      sampleSize: [
        sampleSize$,
        (value) => sampleSize$.next(value),
        (a, b) => (a ?? defaultSampleSize) === (b ?? defaultSampleSize),
      ],
      rowsPerPage: [
        rowsPerPage$,
        (value) => rowsPerPage$.next(value),
        (a, b) => (a ?? defaultRowsPerPage) === (b ?? defaultRowsPerPage),
      ],
      rowHeight: [
        rowHeight$,
        (value) => rowHeight$.next(value),
        (a, b) => (a ?? defaultRowHeight) === (b ?? defaultRowHeight),
      ],
      headerRowHeight: [
        headerRowHeight$,
        (value) => headerRowHeight$.next(value),
        (a, b) => (a ?? DEFAULT_HEADER_ROW_HEIGHT_LINES) === (b ?? DEFAULT_HEADER_ROW_HEIGHT_LINES),
      ],
    },
  };
};
