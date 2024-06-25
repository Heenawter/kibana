/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { i18n } from '@kbn/i18n';
import { apiHasAppContext, FetchContext, PublishingSubject } from '@kbn/presentation-publishing';
import { DiscoverServices } from '../build_services';
import { openSavedSearchEditFlyout } from './components/editor/open_saved_search_edit_flyout';
import { SearchEmbeddableApi, SearchEmbeddableStateManager } from './types';
import { getDiscoverLocatorParams } from './utils/get_discover_locator_params';

export async function getAppTarget(api: SearchEmbeddableApi, discoverServices: DiscoverServices) {
  const savedObjectId = api.savedObjectId.getValue();
  const dataViews = api.dataViews.getValue();
  const locatorParams = getDiscoverLocatorParams(api);

  // We need to use a redirect URL if this is a by value saved search using
  // an ad hoc data view to ensure the data view spec gets encoded in the URL
  const useRedirect = !savedObjectId && !dataViews?.[0]?.isPersisted();
  const editUrl = useRedirect
    ? discoverServices.locator.getRedirectUrl(locatorParams)
    : await discoverServices.locator.getUrl(locatorParams);
  const editPath = discoverServices.core.http.basePath.remove(editUrl);
  const editApp = useRedirect ? 'r' : 'discover';

  return { path: editPath, app: editApp, editUrl };
}

export function initializeEditApi({
  uuid,
  parentApi,
  getApi,
  isEditable,
  stateManager,
  discoverServices,
}: {
  uuid: string;
  parentApi?: unknown;
  getApi: () => SearchEmbeddableApi & {
    fetchContext$: PublishingSubject<FetchContext | undefined>;
  };
  isEditable: () => boolean;
  stateManager: SearchEmbeddableStateManager;
  discoverServices: DiscoverServices;
}) {
  /**
   * If the parent is providing context, then the embeddable state transfer service can be used
   * and editing should be allowed; otherwise, do not provide editing capabilities
   */
  if (!isEditable || !parentApi || !apiHasAppContext(parentApi)) {
    return {};
  }
  const parentApiContext = parentApi.getAppContext();

  const navigateToEditor = async () => {
    const api = getApi();
    const stateTransfer = discoverServices.embeddable.getStateTransfer();
    const appTarget = await getAppTarget(api, discoverServices);
    await stateTransfer.navigateToEditor(appTarget.app, {
      path: appTarget.path,
      state: {
        embeddableId: uuid,
        valueInput: api.savedSearch$.getValue(),
        originatingApp: parentApiContext.currentAppId,
        searchSessionId: api.fetchContext$.getValue()?.searchSessionId,
        originatingPath: parentApiContext.getCurrentPath?.(),
      },
    });
  };

  return {
    getTypeDisplayName: () =>
      i18n.translate('discover.embeddable.search.displayName', {
        defaultMessage: 'search',
      }),
    onEdit: async () => {
      const api = getApi();
      await openSavedSearchEditFlyout({
        api,
        parentApi,
        id: uuid,
        stateManager,
        isEditing: true,
        navigateToEditor,
        services: discoverServices,
      });
      // const stateTransfer = discoverServices.embeddable.getStateTransfer();
      // const appTarget = await getAppTarget(partialApi, discoverServices);
      // await stateTransfer.navigateToEditor(appTarget.app, {
      //   path: appTarget.path,
      //   state: {
      //     embeddableId: uuid,
      //     valueInput: partialApi.savedSearch$.getValue(),
      //     originatingApp: parentApiContext.currentAppId,
      //     searchSessionId: partialApi.fetchContext$.getValue()?.searchSessionId,
      //     originatingPath: parentApiContext.getCurrentPath?.(),
      //   },
      // });
    },
    isEditingEnabled: isEditable,
    getEditHref: async () => {
      return (await getAppTarget(getApi(), discoverServices))?.path;
    },
  };
}
