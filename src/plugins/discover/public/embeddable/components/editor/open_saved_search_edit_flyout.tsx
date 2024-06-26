/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { lazy, Suspense } from 'react';

import { EuiLoadingSpinner } from '@elastic/eui';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';
import { apiIsPresentationContainer, tracksOverlays } from '@kbn/presentation-containers';
import { KibanaRenderContextProvider } from '@kbn/react-kibana-context-render';
import { toMountPoint } from '@kbn/react-kibana-mount';

import { DiscoverServices } from '../../../build_services';
import { isEsqlMode } from '../../initialize_fetch';
import { SearchEmbeddableApi } from '../../types';

const SavedSearchEditorFlyout = lazy(() => import('./saved_search_edit_flyout'));

export const openSavedSearchEditFlyout = async ({
  isEditing,
  services,
  api,
  navigateToEditor,
}: {
  isEditing: boolean;
  services: DiscoverServices;
  api: SearchEmbeddableApi;
  navigateToEditor?: () => Promise<void>;
}) => {
  const overlayTracker = tracksOverlays(api.parentApi) ? api.parentApi : undefined;
  const initialState = api.snapshotRuntimeState();
  const isEsql = isEsqlMode(api.savedSearch$.getValue());

  return new Promise(async (resolve, reject) => {
    try {
      const onCancel = async () => {
        if (!isEditing && apiIsPresentationContainer(api.parentApi)) {
          api.parentApi.removePanel(api.uuid);
        } else {
          // Reset to initialState
          const stateManager = api.getStateManager();
          const initialSearchSource = await services.data.search.searchSource.create(
            initialState.serializedSearchSource
          );
          stateManager.searchSource.next(initialSearchSource);
          stateManager.columns.next(initialState.columns);
        }
        flyoutSession.close();
        overlayTracker?.clearOverlays();
      };

      const onSave = async () => {
        flyoutSession.close();
        overlayTracker?.clearOverlays();
      };

      const flyoutSession = services.core.overlays.openFlyout(
        toMountPoint(
          <KibanaRenderContextProvider {...services}>
            <KibanaContextProvider services={services}>
              <Suspense fallback={<EuiLoadingSpinner />}>
                <SavedSearchEditorFlyout
                  api={api}
                  isEsql={isEsql}
                  onSave={onSave}
                  onCancel={onCancel}
                  services={services}
                  isEditing={isEditing}
                  stateManager={api.getStateManager()}
                  navigateToEditor={navigateToEditor}
                />
              </Suspense>
            </KibanaContextProvider>
          </KibanaRenderContextProvider>,
          services.core
        ),
        {
          ownFocus: true,
          size: 's',
          type: 'push',
          'data-test-subj': 'fieldStatisticsInitializerFlyout',
          onClose: onCancel,
          paddingSize: 'm',
          hideCloseButton: true,
          className: 'lnsConfigPanel__overlay savedSearchFlyout',
        }
      );

      if (tracksOverlays(api.parentApi)) {
        api.parentApi.openOverlay(flyoutSession, { focusedPanelId: api.uuid });
      }
    } catch (error) {
      reject(error);
    }
  });
};
