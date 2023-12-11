/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import deepEqual from 'fast-deep-equal';
import { get } from 'lodash';
import React, { createContext, useContext } from 'react';
import ReactDOM from 'react-dom';
import { batch } from 'react-redux';
import { lastValueFrom, Subscription, switchMap } from 'rxjs';
import { distinctUntilChanged, map, skip } from 'rxjs/operators';
import moment from 'moment';

import { DataView, DataViewField } from '@kbn/data-views-plugin/public';
import { Embeddable, IContainer } from '@kbn/embeddable-plugin/public';
import { compareFilters, COMPARE_ALL_OPTIONS, Filter } from '@kbn/es-query';
import { ReduxEmbeddableTools, ReduxToolsPackage } from '@kbn/presentation-util-plugin/public';
import { KibanaThemeProvider } from '@kbn/react-kibana-context-theme';

import { ControlOutput } from '../..';
import { TimePickerEmbeddableInput, TIME_PICKER_CONTROL } from '../../../common/time_picker/types';
import { pluginServices } from '../../services';
import { ControlsDataService } from '../../services/data/types';
import { ControlsDataViewsService } from '../../services/data_views/types';
import { ControlInput, IClearableControl } from '../../types';
import { TimePickerControl } from '../components/time_picker_control';
import { getDefaultComponentState, timePickerReducers } from '../time_picker_reducers';
import { TimePickerReduxState } from '../types';
import { i18n } from '@kbn/i18n';
import { ControlsTimePickerService } from '../../services/time_picker/types';

const diffDataFetchProps = (
  current?: TimeSliderDataFetchProps,
  last?: TimeSliderDataFetchProps
) => {
  if (!current || !last) return false;
  const { filters: currentFilters, ...currentWithoutFilters } = current;
  const { filters: lastFilters, ...lastWithoutFilters } = last;
  if (!deepEqual(currentWithoutFilters, lastWithoutFilters)) return false;
  if (!compareFilters(lastFilters ?? [], currentFilters ?? [], COMPARE_ALL_OPTIONS)) return false;
  return true;
};

interface TimeSliderDataFetchProps {
  fieldName: string;
  dataViewId: string;
  query?: ControlInput['query'];
  filters?: ControlInput['filters'];
  validate?: boolean;
}

export const TimePickerControlContext = createContext<TimePickerEmbeddable | null>(null);
export const useTimePicker = (): TimePickerEmbeddable => {
  const timePicker = useContext<TimePickerEmbeddable | null>(TimePickerControlContext);
  if (timePicker == null) {
    throw new Error('useTimePicker must be used inside TimePickerControlContext.');
  }
  return timePicker!;
};

type TimePickerReduxEmbeddableTools = ReduxEmbeddableTools<
  TimePickerReduxState,
  typeof timePickerReducers
>;

export class TimePickerEmbeddable
  extends Embeddable<TimePickerEmbeddableInput, ControlOutput>
  implements IClearableControl
{
  public readonly type = TIME_PICKER_CONTROL;
  public deferEmbeddableLoad = true;

  private subscriptions: Subscription = new Subscription();
  private node?: HTMLElement;

  // Controls services
  private dataService: ControlsDataService;
  private dataViewsService: ControlsDataViewsService;
  private timePickerService: ControlsTimePickerService;

  // Internal data fetching state for this input control.
  private dataView?: DataView;
  private field?: DataViewField;
  private filters: Filter[] = [];
  private abortController?: AbortController;

  // state management
  public select: TimePickerReduxEmbeddableTools['select'];
  public getState: TimePickerReduxEmbeddableTools['getState'];
  public dispatch: TimePickerReduxEmbeddableTools['dispatch'];
  public onStateChange: TimePickerReduxEmbeddableTools['onStateChange'];

  private cleanupStateTools: () => void;

  constructor(
    reduxToolsPackage: ReduxToolsPackage,
    input: TimePickerEmbeddableInput,
    output: ControlOutput,
    parent?: IContainer
  ) {
    super(input, output, parent); // get filters for initial output...

    // Destructure controls services
    ({
      data: this.dataService,
      dataViews: this.dataViewsService,
      timePicker: this.timePickerService,
    } = pluginServices.getServices());

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

    await this.runTimePickerQuery();

    if (initialValue) {
      this.setInitializationFinished();
    }

    this.setupSubscriptions();
  };

  private setupSubscriptions = () => {
    const dataFetchPipe = this.getInput$().pipe(
      map((newInput) => ({
        validate: !Boolean(newInput.ignoreParentSettings?.ignoreValidations),
        lastReloadRequestTime: newInput.lastReloadRequestTime,
        dataViewId: newInput.dataViewId,
        fieldName: newInput.fieldName,
        timeRange: newInput.timeRange,
        timeslice: newInput.timeslice,
        filters: newInput.filters,
        query: newInput.query,
      })),
      distinctUntilChanged(diffDataFetchProps),
      skip(1)
    );

    // fetch available min/max when input changes
    this.subscriptions.add(
      dataFetchPipe
        .pipe(
          switchMap(async (changes) => {
            try {
              const { dataView, field } = await this.getCurrentDataViewAndField();
              if (!dataView || !field) throw new Error();

              await this.runTimePickerQuery();
            } catch (e) {
              this.onLoadingError(e.message);
            }
          })
        )
        .subscribe()
    );
  };

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

  private getCurrentDataViewAndField = async (): Promise<{
    dataView?: DataView;
    field?: DataViewField;
  }> => {
    const {
      explicitInput: { dataViewId, fieldName },
    } = this.getState();

    if (!this.dataView || this.dataView.id !== dataViewId) {
      try {
        this.dataView = await this.dataViewsService.get(dataViewId);
        this.dispatch.setDataViewId(this.dataView.id);
      } catch (e) {
        this.onLoadingError(e.message);
      }
    }

    if (this.dataView && (!this.field || this.field.name !== fieldName)) {
      this.field = this.dataView.getFieldByName(fieldName);
      if (this.field) {
        this.dispatch.setField(this.field?.toSpec());
      } else {
        this.onLoadingError(
          i18n.translate('controls.timePicker.errors.fieldNotFound', {
            defaultMessage: 'Could not locate field: {fieldName}',
            values: { fieldName },
          })
        );
      }
    }

    return { dataView: this.dataView, field: this.field };
  };

  private runTimePickerQuery = async () => {
    const { dataView, field } = await this.getCurrentDataViewAndField();
    if (!dataView || !field) return;

    this.dispatch.setLoading(true);
    const {
      // ignoreParentSettings,
      filters,
      query,
      timeRange: globalTimeRange,
      timeslice,
    } = this.getInput();
    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();
    const timeRange =
      timeslice !== undefined
        ? {
            from: new Date(timeslice[0]).toISOString(),
            to: new Date(timeslice[1]).toISOString(),
            mode: 'absolute' as 'absolute',
          }
        : globalTimeRange;

    const response = await this.timePickerService.runTimePickerRequest(
      {
        field,
        query,
        filters,
        dataView,
        timeRange,
      },
      this.abortController.signal
    );

    if (this.timePickerService.timePickerResponseWasFailure(response)) {
      if (response.error === 'aborted') {
        return;
      }
      this.dispatch.setErrorMessage(response.error.message);
      return;
    }

    const { min, max } = response;
    console.log('minmax', min, max);
    this.dispatch.setMinMax([min, max]);
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
            <TimePickerControl />
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
