/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { EuiPanel, EuiSpacer } from '@elastic/eui';
import { DataViewListItem } from '@kbn/data-views-plugin/common';
import { i18n } from '@kbn/i18n';
import {
  PublishesDataViews,
  useBatchedOptionalPublishingSubjects,
  useBatchedPublishingSubjects,
} from '@kbn/presentation-publishing';
import { DataView } from '@kbn/data-views-plugin/common';
import { LazyDataViewPicker, withSuspense } from '@kbn/presentation-util-plugin/public';
import {
  UnifiedFieldListSidebarContainer,
  type UnifiedFieldListSidebarContainerProps,
} from '@kbn/unified-field-list';

import { DiscoverServices } from '../../../build_services';
import { SearchEmbeddableApi, SearchEmbeddableStateManager } from '../../types';
import useAsync from 'react-use/lib/useAsync';

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
  services,
}: {
  api: SearchEmbeddableApi;
  stateManager: SearchEmbeddableStateManager;
  services: DiscoverServices;
}) {
  const initialState = useRef({
    columns: stateManager.columns.getValue(),
    dataViewId: stateManager.dataViewId.getValue(),
  });
  const [selectedDataViewId, columns] = useBatchedPublishingSubjects(
    stateManager.dataViewId,
    stateManager.columns
  );
  const [dataViews, setDataViews] = useState<DataViewListItem[]>([]);
  const [selectedDataView, setSelectedDataView] = useState<DataView | undefined>(undefined);

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

  useEffect(() => {
    let mounted = true;
    const fetchDataView = async () => {
      if (!selectedDataViewId) return;
      const dataView = await services.data.dataViews.get(selectedDataViewId);
      if (mounted) {
        setSelectedDataView(dataView);
        stateManager.dataViews.next([dataView]);
      }
    };
    fetchDataView();
    return () => {
      mounted = false;
    };
  }, [selectedDataViewId, services.data.dataViews, stateManager.dataViews, stateManager.columns]);

  return (
    <>
      <EuiPanel className="editorPanel" paddingSize="s">
        <DataViewPicker
          dataViews={dataViews ?? []}
          selectedDataViewId={selectedDataViewId}
          onChangeDataViewId={(nextSelection) => {
            stateManager.dataViewId.next(nextSelection);
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
      {/* <EuiSpacer size="m" /> */}
      {/* <EuiPanel className="editorPanel" paddingSize="s">
        test
      </EuiPanel> */}
    </>
  );
}
