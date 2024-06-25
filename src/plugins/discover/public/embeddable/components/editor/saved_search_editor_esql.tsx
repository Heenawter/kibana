/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useBatchedPublishingSubjects } from '@kbn/presentation-publishing';
import { LazyDataViewPicker, withSuspense } from '@kbn/presentation-util-plugin/public';
import {
  UnifiedFieldListSidebarContainer,
  type UnifiedFieldListSidebarContainerProps,
} from '@kbn/unified-field-list';

import { AggregateQuery } from '@kbn/es-query';
import { TextBasedLangEditor } from '@kbn/text-based-languages/public';
import { DiscoverServices } from '../../../build_services';
import { SearchEmbeddableApi, SearchEmbeddableStateManager } from '../../types';
import { EuiPanel, EuiSpacer } from '@elastic/eui';

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

export function SavedSearchEsqlEditor({
  api,
  stateManager,
  services,
}: {
  api: SearchEmbeddableApi;
  stateManager: SearchEmbeddableStateManager;
  services: DiscoverServices;
}) {
  const [dataView, columns, searchSource, loading] = useBatchedPublishingSubjects(
    stateManager.dataView,
    stateManager.columns,
    stateManager.searchSource,
    api.dataLoading
  );
  const [query, setQuery] = useState<AggregateQuery>(
    searchSource.getField('query') as AggregateQuery
  );
  const prevQuery = useRef<AggregateQuery>(query);

  const onTextLangQuerySubmit = useCallback(
    async (q) => {
      if (q) {
        stateManager.searchSource.next(searchSource.setField('query', q));
      }
    },
    [searchSource, stateManager.searchSource]
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
            allFields={dataView.fields}
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
        </EuiPanel>
      )}
    </>
  );
}
