/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { SearchSource } from '@kbn/data-plugin/common';
import { DataView } from '@kbn/data-views-plugin/common';
import { DataTableRecord, SEARCH_EMBEDDABLE_TYPE } from '@kbn/discover-utils';
import { embeddableInputToSubject } from '@kbn/embeddable-plugin/public';
import { getESQLWithSafeLimit } from '@kbn/esql-utils';
import { i18n } from '@kbn/i18n';
import { CanAddNewPanel } from '@kbn/presentation-containers';
import { EmbeddableApiContext } from '@kbn/presentation-publishing';
import { IncompatibleActionError } from '@kbn/ui-actions-plugin/public';
import { BehaviorSubject } from 'rxjs';
import { DiscoverServices } from '../../build_services';
import {
  SearchEmbeddableApi,
  SearchEmbeddableRuntimeState,
  SearchEmbeddableSerializedState,
} from '../types';

export const ADD_SEARCH_EMBEDDABLE_ACTION_ID = 'create_saved_search_embeddable';

const parentApiIsCompatible = async (parentApi: unknown): Promise<CanAddNewPanel | undefined> => {
  const { apiCanAddNewPanel } = await import('@kbn/presentation-containers');
  // we cannot have an async type check, so return the casted parentApi rather than a boolean
  return apiCanAddNewPanel(parentApi) ? (parentApi as CanAddNewPanel) : undefined;
};

export const registerCreateSavedSearchAction = (discoverServices: DiscoverServices) => {
  discoverServices.uiActions.registerAction<EmbeddableApiContext>({
    id: ADD_SEARCH_EMBEDDABLE_ACTION_ID,
    getIconType: () => 'discoverApp',
    isCompatible: async ({ embeddable: parentApi }) => {
      return Boolean(await parentApiIsCompatible(parentApi));
    },
    execute: async ({ embeddable: parentApi }) => {
      const canAddNewPanelParent = await parentApiIsCompatible(parentApi);
      if (!canAddNewPanelParent) throw new IncompatibleActionError();
      const { openSavedSearchEditFlyout } = await import(
        '../components/editor/open_saved_search_edit_flyout'
      );
      try {
        const savedSearch = discoverServices.savedSearch.getNew();
        const defaultIndexPattern = await discoverServices.data.dataViews.getDefault();
        if (defaultIndexPattern) {
          const queryString = getESQLWithSafeLimit(
            `from ${defaultIndexPattern?.getIndexPattern()}`,
            10
          );
          savedSearch.searchSource.setField('index', defaultIndexPattern);
          savedSearch.searchSource.setField('query', { esql: queryString });
        }
        const { searchSourceJSON, references } = savedSearch.searchSource.serialize();

        const embeddable = await canAddNewPanelParent.addNewPanel<SearchEmbeddableSerializedState>({
          panelType: SEARCH_EMBEDDABLE_TYPE,
          initialState: {
            attributes: {
              isTextBasedQuery: true,
              kibanaSavedObjectMeta: {
                searchSourceJSON,
              },
              references,
            },
          },
        });

        // open the flyout if embeddable has been created successfully
        if (embeddable) {
          await openSavedSearchEditFlyout({
            isEditing: false,
            services: discoverServices,
            api: embeddable as SearchEmbeddableApi,
          });
        }
      } catch {
        // swallow the rejection, since this just means the user closed without saving
      }
    },
    getDisplayName: () =>
      i18n.translate('discover.embeddable.search.displayName', {
        defaultMessage: 'Saved search',
      }),
  });

  discoverServices.uiActions.attachAction('ADD_PANEL_TRIGGER', ADD_SEARCH_EMBEDDABLE_ACTION_ID);
};
