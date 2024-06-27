/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounceTime } from 'rxjs';

import { EuiPanel, EuiSpacer } from '@elastic/eui';
import { DashboardContainer } from '@kbn/dashboard-plugin/public/dashboard_container';
import { AggregateQuery, Filter, isOfAggregateQueryType } from '@kbn/es-query';
import { useBatchedPublishingSubjects } from '@kbn/presentation-publishing';
import { TextBasedLangEditor } from '@kbn/text-based-languages/public';
import {
  UnifiedFieldListSidebarContainer,
  type UnifiedFieldListSidebarContainerProps,
} from '@kbn/unified-field-list';

import { useDiscoverServices } from '../../../hooks/use_discover_services';
import { SearchEmbeddableApi, SearchEmbeddableStateManager } from '../../types';
import { getEsqlQueryFieldList } from '../../../application/main/components/sidebar/lib/get_field_list';

const getCreationOptions: UnifiedFieldListSidebarContainerProps['getCreationOptions'] = () => {
  return {
    originatingApp: '', // TODO
    localStorageKeyPrefix: 'savedSearch',
    compressed: true,
    showSidebarToggleButton: false,
    // disableFieldListItemDragAndDrop: true,
  };
};

export function SavedSearchEsqlEditor({
  api,
  stateManager,
  setIsValid,
}: {
  api: SearchEmbeddableApi;
  stateManager: SearchEmbeddableStateManager;
  setIsValid: (valid: boolean) => void;
}) {
  const services = useDiscoverServices();

  const [savedSearch, loading, esqlQueryColumns] = useBatchedPublishingSubjects(
    api.savedSearch$,
    api.dataLoading,
    stateManager.esqlQueryColumns
  );
  const [query, setQuery] = useState<AggregateQuery>(
    savedSearch.searchSource.getField('query') as AggregateQuery
  );
  const prevQuery = useRef<AggregateQuery>(query);

  useEffect(() => {
    (api.parentApi as DashboardContainer).ignoreUnifiedSearch = true;
    (api.parentApi as DashboardContainer).dispatch.setDisableQueryInput(true);
    (api.parentApi as DashboardContainer).dispatch.setDisableAutoRefresh(true);

    /** Handle filters */
    const originalFilters = services.filterManager.getFilters();
    const customFilters = (savedSearch.searchSource.getField('filter') ?? []) as Filter[];
    if (customFilters.length > 0) {
      services.filterManager.setFilters(customFilters);
    }
    const filtersSubscription = services.filterManager
      .getUpdates$()
      .pipe(debounceTime(1))
      .subscribe(() => {
        const newFilters = services.filterManager.getFilters();
        stateManager.searchSource.next(savedSearch.searchSource.setField('filter', newFilters));
      });

    /** Handle time range */
    const originalTime = services.timefilter.getTime();
    const customTimeRange = api.timeRange$?.getValue();
    if (customTimeRange) {
      services.timefilter.setTime(customTimeRange);
    }
    const timeRangeSubscription = services.timefilter
      .getTimeUpdate$()
      .pipe(debounceTime(1))
      .subscribe(() => {
        const newTimeRange = services.timefilter.getTime();
        api.setTimeRange(newTimeRange);
      });

    return () => {
      services.filterManager.setFilters(originalFilters);
      services.timefilter.setTime(originalTime);

      (api.parentApi as DashboardContainer).ignoreUnifiedSearch = false;
      (api.parentApi as DashboardContainer).dispatch.setDisableQueryInput(false);
      (api.parentApi as DashboardContainer).dispatch.setDisableAutoRefresh(false);
      filtersSubscription.unsubscribe();
      timeRangeSubscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dataView = useMemo(() => {
    return savedSearch.searchSource.getField('index');
  }, [savedSearch]);

  const onTextLangQuerySubmit = useCallback(
    async (q) => {
      if (q) {
        stateManager.searchSource.next(savedSearch.searchSource.setField('query', q));
        setIsValid(isOfAggregateQueryType(q) && q.esql !== '');
      }
    },
    [savedSearch.searchSource, stateManager.searchSource, setIsValid]
  );

  return (
    <>
      {query && (
        <div className="esqlEditor">
          <TextBasedLangEditor
            query={query}
            onTextLangQueryChange={(q) => {
              setQuery(q);
              prevQuery.current = q;
            }}
            expandCodeEditor={(status: boolean) => {}}
            isCodeEditorExpanded
            hideMinimizeButton
            editorIsInline
            hideRunQueryText
            onTextLangQuerySubmit={onTextLangQuerySubmit}
            isDisabled={false}
            allowQueryCancellation
            isLoading={loading}
          />
        </div>
      )}
      <EuiSpacer size="m" />
      {dataView && (
        <EuiPanel className="editorPanel" paddingSize="s">
          <UnifiedFieldListSidebarContainer
            fullWidth
            variant="responsive"
            dataView={dataView}
            showFieldList={true}
            allFields={getEsqlQueryFieldList(esqlQueryColumns)}
            getCreationOptions={getCreationOptions}
            workspaceSelectedFieldNames={savedSearch.columns}
            services={services}
            onAddFieldToWorkspace={(field) =>
              stateManager.columns.next([...(savedSearch.columns ?? []), field.name])
            }
            onRemoveFieldFromWorkspace={(field) => {
              stateManager.columns.next(
                (savedSearch.columns ?? []).filter((name) => name !== field.name)
              );
            }}
          />
        </EuiPanel>
      )}
    </>
  );
}
