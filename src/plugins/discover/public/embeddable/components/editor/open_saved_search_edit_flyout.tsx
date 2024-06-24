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
import { tracksOverlays } from '@kbn/presentation-containers';
import { KibanaRenderContextProvider } from '@kbn/react-kibana-context-render';
import { toMountPoint } from '@kbn/react-kibana-mount';

import { DiscoverServices } from '../../../build_services';
import { SearchEmbeddableApi, SearchEmbeddableStateManager } from '../../types';
import { isEsqlMode } from '../../initialize_fetch';

const SavedSearchEditorFlyout = lazy(() => import('./saved_search_edit_flyout'));

export const openSavedSearchEditFlyout = async ({
  id,
  api,
  isEditing,
  services,
  stateManager,
  navigateToEditor,
}: {
  id: string;
  api: SearchEmbeddableApi;
  isEditing: boolean;
  services: DiscoverServices;
  stateManager: SearchEmbeddableStateManager;
  navigateToEditor: () => Promise<void>;
}) => {
  const overlayTracker = tracksOverlays(api.parentApi) ? api.parentApi : undefined;
  // const initialState = api.snapshotRuntimeState();
  const isEsql = isEsqlMode(api.savedSearch$.getValue());

  return new Promise(async (resolve, reject) => {
    try {
      const onCancel = () => {
        // Reset to initialState in case user has changed the preview state
        // if (deepEqual(initialState, newState)) {
        //   closeOverlay(overlay);
        //   return;
        // }

        // if (hasChanged && fieldStatsControlsApi && initialState) {
        //   fieldStatsControlsApi.updateUserInput(initialState);
        // }

        flyoutSession.close();
        overlayTracker?.clearOverlays();
      };

      const onSave = async () => {
        // const esqlQuery = nextUpdate?.query?.esql;
        // if (isDefined(esqlQuery)) {
        //   const indexPatternFromQuery = getIndexPatternFromESQLQuery(esqlQuery);
        //   const dv = await getOrCreateDataViewByIndexPattern(
        //     pluginStart.data.dataViews,
        //     indexPatternFromQuery,
        //     undefined
        //   );
        //   if (dv?.id && nextUpdate.dataViewId !== dv.id) {
        //     nextUpdate.dataViewId = dv.id;
        //   }
        // }
        // resolve(nextUpdate);
        // flyoutSession.close();
        // overlayTracker?.clearOverlays();
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
                  stateManager={stateManager}
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
        api.parentApi.openOverlay(flyoutSession, { focusedPanelId: id });
      }
    } catch (error) {
      reject(error);
    }
  });
};
