/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useState } from 'react';

import {
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiLink,
  EuiTitle,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';
import { euiThemeVars } from '@kbn/ui-theme';

import { DiscoverServices } from '../../../build_services';
import { SearchEmbeddableApi, SearchEmbeddableStateManager } from '../../types';
import { SavedSearchDataviewEditor } from './saved_search_editor_dataview';
import { SavedSearchEsqlEditor } from './saved_search_editor_esql';
import './saved_search_edit_flyout.scss';

// eslint-disable-next-line import/no-default-export
export default function SavedSearchEditorFlyout({
  api,
  isEsql,
  isEditing,
  navigateToEditor,
  onCancel,
  onSave,
  stateManager,
  services,
}: {
  api: SearchEmbeddableApi;
  isEsql: boolean;
  isEditing: boolean;
  navigateToEditor?: () => Promise<void>;
  onCancel: () => Promise<void>;
  onSave: () => Promise<void>;
  stateManager: SearchEmbeddableStateManager;
  services: DiscoverServices;
}) {
  const [isValid, setIsValid] = useState<boolean>(true);

  return (
    <>
      <EuiFlyoutHeader
        hasBorder
        css={css`
          pointer-events: auto;
          background-color: ${euiThemeVars.euiColorEmptyShade};
        `}
        data-test-subj="editFlyoutHeader"
      >
        <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiTitle size="xs" data-test-subj="inlineEditingFlyoutLabel">
              <h2>
                {isEditing
                  ? i18n.translate('discover.embeddable.search.editor.editLabel', {
                      defaultMessage: 'Edit saved search',
                    })
                  : i18n.translate('discover.embeddable.search.editor.createLabel', {
                      defaultMessage: 'Create saved search',
                    })}
              </h2>
            </EuiTitle>
          </EuiFlexItem>

          {navigateToEditor && (
            <EuiFlexItem grow={false}>
              <EuiLink onClick={navigateToEditor}>
                {i18n.translate('discover.embeddable.search.editor.editLinkLabel', {
                  defaultMessage: 'Edit in Discover',
                })}
              </EuiLink>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        {isEsql ? (
          <SavedSearchEsqlEditor api={api} stateManager={stateManager} setIsValid={setIsValid} />
        ) : (
          <SavedSearchDataviewEditor api={api} stateManager={stateManager} />
        )}
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="spaceBetween">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              id="lnsCancelEditOnFlyFlyout"
              onClick={onCancel}
              flush="left"
              aria-label={i18n.translate(
                'discover.embeddable.search.editor.cancelFlyoutAriaLabel',
                {
                  defaultMessage: 'Cancel applied changes',
                }
              )}
            >
              {i18n.translate('discover.embeddable.search.editor.cancelFlyoutLabel', {
                defaultMessage: 'Cancel',
              })}
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              onClick={onSave}
              fill
              aria-label={i18n.translate('discover.embeddable.search.editor.applyFlyoutAriaLabel', {
                defaultMessage: 'Apply changes',
              })}
              disabled={isEsql ? !isValid : false}
              iconType="check"
            >
              {i18n.translate('discover.embeddable.search.editor.applyFlyoutLabel', {
                defaultMessage: 'Apply and close',
              })}
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </>
  );
}
