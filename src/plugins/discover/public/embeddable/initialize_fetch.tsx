/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { BehaviorSubject, combineLatest, lastValueFrom, switchMap } from 'rxjs';

import {
  buildDataTableRecord,
  SEARCH_EMBEDDABLE_TYPE,
  SEARCH_FIELDS_FROM_SOURCE,
  SORT_DEFAULT_ORDER_SETTING,
} from '@kbn/discover-utils';
import { EsHitRecord } from '@kbn/discover-utils/types';
import { isOfAggregateQueryType, isOfQueryType } from '@kbn/es-query';
import { i18n } from '@kbn/i18n';
import { RequestAdapter } from '@kbn/inspector-plugin/common';
import {
  apiHasExecutionContext,
  apiHasParentApi,
  fetch$,
  FetchContext,
} from '@kbn/presentation-publishing';
import { SavedSearch } from '@kbn/saved-search-plugin/public';
import { SearchResponseWarning } from '@kbn/search-response-warnings';
import { getTextBasedColumnsMeta } from '@kbn/unified-data-table';

import { createDataViewDataSource, createEsqlDataSource } from '../../common/data_sources';
import { fetchEsql } from '../application/main/data_fetching/fetch_esql';
import { DiscoverServices } from '../build_services';
import { getAllowedSampleSize } from '../utils/get_allowed_sample_size';
import { SearchEmbeddableApi } from './types';
import { getTimeRangeFromFetchContext, updateSearchSource } from './utils/update_search_source';

export const isEsqlMode = (savedSearch: Pick<SavedSearch, 'searchSource'>): boolean => {
  const query = savedSearch.searchSource.getField('query');
  return isOfAggregateQueryType(query);
};

export function initializeFetch({
  api,
  discoverServices,
}: {
  api: SearchEmbeddableApi & {
    fetchContext$: BehaviorSubject<FetchContext | undefined>;
    dataLoading: BehaviorSubject<boolean | undefined>;
    blockingError: BehaviorSubject<Error | undefined>;
  };
  discoverServices: DiscoverServices;
}) {
  const requestAdapter = new RequestAdapter();
  let abortController = new AbortController(); // ???

  // const solutionNavId = await firstValueFrom(
  //   this.services.core.chrome.getActiveSolutionNavId$()
  // );

  // await this.services.profilesManager.resolveRootProfile({ solutionNavId });

  const fetchSubscription = combineLatest([fetch$(api), api.sort$])
    .pipe(
      switchMap(async ([fetchContext, sort]) => {
        api.blockingError.next(undefined);
        const dataView = api.dataViews.getValue()?.[0];
        const searchSource = api.searchSource$.getValue();
        if (!dataView || !searchSource) {
          return;
        }
        // Abort any in-progress requests
        abortController.abort();
        abortController = new AbortController();

        const useNewFieldsApi = !discoverServices.uiSettings.get(SEARCH_FIELDS_FROM_SOURCE, false);
        const sampleSize = api.sampleSize$.getValue();
        updateSearchSource(
          discoverServices,
          searchSource,
          dataView,
          sort,
          getAllowedSampleSize(sampleSize, discoverServices.uiSettings),
          useNewFieldsApi,
          fetchContext,
          {
            sortDir: discoverServices.uiSettings.get(SORT_DEFAULT_ORDER_SETTING),
          }
        );

        const searchSessionId = fetchContext.searchSessionId;
        const searchSourceQuery = searchSource.getField('query');

        try {
          api.dataLoading.next(true);
          // Log request to inspector
          requestAdapter.reset();

          await discoverServices.profilesManager.resolveDataSourceProfile({
            dataSource: isOfAggregateQueryType(searchSourceQuery)
              ? createEsqlDataSource()
              : dataView.id
              ? createDataViewDataSource({ dataViewId: dataView.id })
              : undefined,
            dataView,
            query: searchSourceQuery,
          });

          const esqlMode = isEsqlMode({ searchSource });
          if (
            esqlMode &&
            searchSourceQuery &&
            (!fetchContext.query || isOfQueryType(fetchContext.query))
          ) {
            // Request ES|QL data
            const result = await fetchEsql({
              query: searchSourceQuery,
              inputTimeRange: getTimeRangeFromFetchContext(fetchContext),
              inputQuery: fetchContext.query,
              filters: fetchContext.filters,
              dataView,
              abortSignal: abortController.signal,
              inspectorAdapters: discoverServices.inspector,
              data: discoverServices.data,
              expressions: discoverServices.expressions,
              profilesManager: discoverServices.profilesManager,
            });
            return {
              columnsMeta: result.esqlQueryColumns
                ? getTextBasedColumnsMeta(result.esqlQueryColumns)
                : undefined,
              rows: result.records,
              hitCount: result.records.length,
              fetchContext,
            };
          }

          /**
           * Fetch via saved search
           */
          const { rawResponse: resp } = await lastValueFrom(
            searchSource.fetch$({
              abortSignal: abortController.signal,
              sessionId: searchSessionId,
              inspector: {
                adapter: requestAdapter,
                title: i18n.translate('discover.embeddable.inspectorRequestDataTitle', {
                  defaultMessage: 'Data',
                }),
                description: i18n.translate('discover.embeddable.inspectorRequestDescription', {
                  defaultMessage:
                    'This request queries Elasticsearch to fetch the data for the search.',
                }),
              },
              executionContext:
                apiHasParentApi(api) && apiHasExecutionContext(api.parentApi)
                  ? api.parentApi?.executionContext
                  : {
                      type: SEARCH_EMBEDDABLE_TYPE,
                      name: 'discover',
                      id: searchSource.getId(),
                      description:
                        api.panelTitle?.getValue() || api.defaultPanelTitle?.getValue() || '',
                      // url: this.output.editUrl,
                    },
              disableWarningToasts: true,
            })
          );

          const interceptedWarnings: SearchResponseWarning[] = [];
          discoverServices.data.search.showWarnings(requestAdapter, (warning) => {
            interceptedWarnings.push(warning);
            return true; // suppress the default behaviour
          });

          return {
            rows: resp.hits.hits.map((hit) => buildDataTableRecord(hit as EsHitRecord, dataView)),
            hitCount: resp.hits.total as number,
            fetchContext,
          };
        } catch (error) {
          return { error };
        }
      })
    )
    .subscribe((next) => {
      api.dataLoading.next(false);
      if (next) {
        if (next.hasOwnProperty('rows')) {
          api.rows$.next(next.rows ?? []);
        }
        if (next.hasOwnProperty('hitCount')) {
          api.totalHitCount$.next(next.hitCount);
        }
        if (next.hasOwnProperty('columnsMeta')) {
          api.columnsMeta$.next(next.columnsMeta);
        }
        if (next.hasOwnProperty('fetchContext') && next.fetchContext !== undefined) {
          api.fetchContext$.next(next.fetchContext);
        }
        if (next.hasOwnProperty('error')) {
          api.blockingError.next(next.error);
        }
      }
    });

  return () => {
    fetchSubscription.unsubscribe();
  };
}
