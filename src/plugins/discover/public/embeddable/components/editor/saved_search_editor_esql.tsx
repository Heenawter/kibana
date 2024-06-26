/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBatchedPublishingSubjects } from '@kbn/presentation-publishing';
import {
  UnifiedFieldListSidebarContainer,
  type UnifiedFieldListSidebarContainerProps,
} from '@kbn/unified-field-list';

import { EuiPanel, EuiSpacer } from '@elastic/eui';
import { AggregateQuery } from '@kbn/es-query';
import { TextBasedLangEditor } from '@kbn/text-based-languages/public';
import { useDiscoverServices } from '../../../hooks/use_discover_services';
import { SearchEmbeddableApi, SearchEmbeddableStateManager } from '../../types';

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

  const [savedSearch, loading] = useBatchedPublishingSubjects(api.savedSearch$, api.dataLoading);
  const [query, setQuery] = useState<AggregateQuery>(
    savedSearch.searchSource.getField('query') as AggregateQuery
  );
  const prevQuery = useRef<AggregateQuery>(query);

  const dataView = useMemo(() => {
    return savedSearch.searchSource.getField('index');
  }, [savedSearch]);

  const onTextLangQuerySubmit = useCallback(
    async (q) => {
      if (q) {
        stateManager.searchSource.next(savedSearch.searchSource.setField('query', q));
        if (q.esql === '') {
          setIsValid(false);
        } else {
          setIsValid(true);
        }
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
            allFields={dataView.fields}
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
