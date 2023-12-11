/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { createContext, useContext } from 'react';
import ReactDOM from 'react-dom';
import { batch } from 'react-redux';
import { Subscription } from 'rxjs';

import { DataView, DataViewField } from '@kbn/data-views-plugin/public';
import { Embeddable, IContainer } from '@kbn/embeddable-plugin/public';
import { Filter } from '@kbn/es-query';
import { ReduxEmbeddableTools, ReduxToolsPackage } from '@kbn/presentation-util-plugin/public';
import { KibanaThemeProvider } from '@kbn/react-kibana-context-theme';

import { ControlOutput, RangeSliderEmbeddableInput, RANGE_SLIDER_CONTROL } from '../..';
import { pluginServices } from '../../services';
import { ControlsDataService } from '../../services/data/types';
import { ControlsDataViewsService } from '../../services/data_views/types';
import { IClearableControl } from '../../types';
import { RangeSliderControl } from '../components/time_picker_control';
import { getDefaultComponentState, timePickerReducers } from '../time_picker_reducers';
import { TimePickerReduxState } from '../types';

export const TimePickerControlContext = createContext<TimePickerEmbeddable | null>(null);
export const useTimePicker = (): TimePickerEmbeddable => {
  const timePicker = useContext<TimePickerEmbeddable | null>(TimePickerControlContext);
  if (timePicker == null) {
    throw new Error('useRangeSlider must be used inside RangeSliderControlContext.');
  }
  return timePicker!;
};

type TimePickerReduxEmbeddableTools = ReduxEmbeddableTools<
  TimePickerReduxState,
  typeof timePickerReducers
>;

export class TimePickerEmbeddable
  extends Embeddable<RangeSliderEmbeddableInput, ControlOutput>
  implements IClearableControl
{
  public readonly type = RANGE_SLIDER_CONTROL;
  public deferEmbeddableLoad = true;

  private subscriptions: Subscription = new Subscription();
  private node?: HTMLElement;

  // Controls services
  private dataService: ControlsDataService;
  private dataViewsService: ControlsDataViewsService;

  // Internal data fetching state for this input control.
  private dataView?: DataView;
  private field?: DataViewField;
  private filters: Filter[] = [];

  // state management
  public select: TimePickerReduxEmbeddableTools['select'];
  public getState: TimePickerReduxEmbeddableTools['getState'];
  public dispatch: TimePickerReduxEmbeddableTools['dispatch'];
  public onStateChange: TimePickerReduxEmbeddableTools['onStateChange'];

  private cleanupStateTools: () => void;

  constructor(
    reduxToolsPackage: ReduxToolsPackage,
    input: RangeSliderEmbeddableInput,
    output: ControlOutput,
    parent?: IContainer
  ) {
    super(input, output, parent); // get filters for initial output...

    // Destructure controls services
    ({ data: this.dataService, dataViews: this.dataViewsService } = pluginServices.getServices());

    const reduxEmbeddableTools = reduxToolsPackage.createReduxEmbeddableTools<
      TimePickerReduxState,
      typeof timePickerReducers
    >({
      embeddable: this,
      reducers: timePickerReducers,
      initialComponentState: getDefaultComponentState(),
    });
    this.select = reduxEmbeddableTools.select;
    this.getState = reduxEmbeddableTools.getState;
    this.dispatch = reduxEmbeddableTools.dispatch;
    this.onStateChange = reduxEmbeddableTools.onStateChange;
    this.cleanupStateTools = reduxEmbeddableTools.cleanup;
    this.initialize();
  }

  private initialize = async () => {
    const initialValue = this.getInput().value;
    if (!initialValue) {
      this.setInitializationFinished();
    }

    if (initialValue) {
      this.setInitializationFinished();
    }

    this.setupSubscriptions();
  };

  private setupSubscriptions = () => {};

  private onLoadingError(errorMessage: string) {
    batch(() => {
      this.dispatch.setLoading(false);
      this.dispatch.publishFilters([]);
      this.dispatch.setErrorMessage(errorMessage);
    });
  }

  public reload = async () => {
    try {
      console.log('here');
    } catch (e) {
      this.onLoadingError(e.message);
    }
  };

  public clearSelections: () => void = () => {
    console.log('clear selections');
  };

  public destroy = () => {
    super.destroy();
    this.cleanupStateTools();
    this.subscriptions.unsubscribe();
  };

  public render = (node: HTMLElement) => {
    if (this.node) {
      ReactDOM.unmountComponentAtNode(this.node);
    }
    this.node = node;
    const ControlsServicesProvider = pluginServices.getContextProvider();
    ReactDOM.render(
      <KibanaThemeProvider theme={pluginServices.getServices().core.theme}>
        <ControlsServicesProvider>
          <TimePickerControlContext.Provider value={this}>
            <RangeSliderControl />
          </TimePickerControlContext.Provider>
        </ControlsServicesProvider>
      </KibanaThemeProvider>,
      node
    );
  };

  public isChained() {
    return true;
  }
}
