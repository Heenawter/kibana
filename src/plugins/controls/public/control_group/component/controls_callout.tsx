/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { EuiFlexGroup, EuiFlexItem, EuiText, EuiButtonEmpty, EuiPanel } from '@elastic/eui';
import React from 'react';
import useLocalStorage from 'react-use/lib/useLocalStorage';
import classNames from 'classnames';

import { type ControlGroupContainer } from '../..';
import { ControlGroupStrings } from '../control_group_strings';
import { ControlsIllustration } from './controls_illustration';

const CONTROLS_CALLOUT_STATE_KEY = 'dashboard:controlsCalloutDismissed';

interface CalloutProps {
  controlEmbeddable: ControlGroupContainer | undefined;
  dashboardPanelCount: number;
}

export const ControlsCallout = ({ controlEmbeddable, dashboardPanelCount }: CalloutProps) => {
  const [controlsCalloutDismissed, setControlsCalloutDismissed] = useLocalStorage(
    CONTROLS_CALLOUT_STATE_KEY,
    false
  );
  const dismissControls = () => {
    setControlsCalloutDismissed(true);
  };

  const hideUndismissedCallout =
    dashboardPanelCount === 0 || (controlEmbeddable ? controlEmbeddable.getPanelCount() : -1) > 0;
  if (controlsCalloutDismissed || hideUndismissedCallout) return null;

  return (
    <EuiPanel
      borderRadius="m"
      color="plain"
      paddingSize={'s'}
      className={classNames('controlsWrapper', {
        'controlsWrapper--empty': true,
      })}
    >
      <EuiFlexGroup alignItems="center" gutterSize="xs" data-test-subj="controls-empty">
        <EuiFlexItem grow={1} className="controlsIllustration__container">
          <EuiFlexGroup alignItems="center" gutterSize="xs" responsive={false}>
            <EuiFlexItem grow={false}>
              <ControlsIllustration />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiText className="emptyStateText" size="s">
                <p>{ControlGroupStrings.emptyState.getCallToAction()}</p>
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          {controlEmbeddable?.getCreateControlButton('callout')}
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="s" onClick={dismissControls}>
            {ControlGroupStrings.emptyState.getDismissButton()}
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};
