/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { EuiPanel, EuiSpacer } from '@elastic/eui';
import { DataViewListItem } from '@kbn/data-views-plugin/common';
import { i18n } from '@kbn/i18n';
import { useBatchedPublishingSubjects } from '@kbn/presentation-publishing';
import { LazyDataViewPicker, withSuspense } from '@kbn/presentation-util-plugin/public';
import {
  UnifiedFieldListSidebarContainer,
  type UnifiedFieldListSidebarContainerProps,
} from '@kbn/unified-field-list';

import { useDiscoverServices } from '../../../hooks/use_discover_services';
import { SearchEmbeddableApi, SearchEmbeddableStateManager } from '../../types';

const DataViewPicker = withSuspense(LazyDataViewPicker, null);

const getCreationOptions: UnifiedFieldListSidebarContainerProps['getCreationOptions'] = () => {
  return {
    originatingApp: '', // TODO
    localStorageKeyPrefix: 'savedSearch',
    compressed: true,
    showSidebarToggleButton: false,
    // disableFieldListItemDragAndDrop: true,
  };
};

export function SavedSearchDataviewEditor({
  api,
  stateManager,
}: {
  api: SearchEmbeddableApi;
  stateManager: SearchEmbeddableStateManager;
}) {
  const services = useDiscoverServices();

  const initialState = useRef({
    columns: stateManager.columns.getValue(),
    dataViewId: stateManager.searchSource.getValue().getField('index')?.id,
  });
  const [savedSearch, columns] = useBatchedPublishingSubjects(
    api.savedSearch$,
    stateManager.columns
  );
  const selectedDataView = savedSearch.searchSource.getField('index');
  const [dataViews, setDataViews] = useState<DataViewListItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchDataViews = async () => {
      const dataViewListItems = await services.data.dataViews.getIdsWithTitle();
      if (mounted) setDataViews(dataViewListItems);
    };
    fetchDataViews();
    return () => {
      mounted = false;
    };
  }, [services.data.dataViews]);

  const onSelectDataView = useCallback(
    async (nextSelection: string) => {
      const dataView = await services.data.dataViews.get(nextSelection);
      stateManager.searchSource.next(savedSearch.searchSource.setField('index', dataView));
    },
    [services.data.dataViews, savedSearch.searchSource, stateManager.searchSource]
  );

  return (
    <>
      <EuiPanel className="editorPanel" paddingSize="s">
        <DataViewPicker
          dataViews={dataViews ?? []}
          selectedDataViewId={selectedDataView?.id}
          onChangeDataViewId={async (nextSelection) => {
            await onSelectDataView(nextSelection);
            if (nextSelection === initialState.current.dataViewId) {
              stateManager.columns.next(initialState.current.columns);
            } else {
              stateManager.columns.next([]);
            }
          }}
          trigger={{
            label:
              selectedDataView?.getName() ??
              i18n.translate('embeddableExamples.unifiedFieldList.selectDataViewMessage', {
                defaultMessage: 'Please select a data view',
              }),
          }}
        />

        {selectedDataView ? (
          <UnifiedFieldListSidebarContainer
            fullWidth
            variant="responsive"
            dataView={selectedDataView}
            showFieldList={true}
            allFields={selectedDataView.fields}
            getCreationOptions={getCreationOptions}
            workspaceSelectedFieldNames={columns}
            services={services}
            onAddFieldToWorkspace={(field) =>
              stateManager.columns.next([...(columns ?? []), field.name])
            }
            onRemoveFieldFromWorkspace={(field) => {
              stateManager.columns.next((columns ?? []).filter((name) => name !== field.name));
            }}
          />
        ) : (
          <>error</>
        )}
      </EuiPanel>
      <EuiSpacer size="m" />
      <EuiPanel className="editorPanel" paddingSize="s">
        test
      </EuiPanel>
    </>
  );
}
