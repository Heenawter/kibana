/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { WritableDraft } from 'immer/dist/types/types-external';
import { PayloadAction } from '@reduxjs/toolkit';

import { FieldSpec } from '@kbn/data-views-plugin/common';
import { Filter } from '@kbn/es-query';

import { TimePickerReduxState } from './types';

export const getDefaultComponentState = (): TimePickerReduxState['componentState'] => ({
  isInvalid: false,
});

export const timePickerReducers = {
  setField: (
    state: WritableDraft<TimePickerReduxState>,
    action: PayloadAction<FieldSpec | undefined>
  ) => {
    state.componentState.field = action.payload;
  },
  setDataViewId: (
    state: WritableDraft<TimePickerReduxState>,
    action: PayloadAction<string | undefined>
  ) => {
    state.output.dataViewId = action.payload;
  },
  setErrorMessage: (
    state: WritableDraft<TimePickerReduxState>,
    action: PayloadAction<string | undefined>
  ) => {
    state.componentState.error = action.payload;
  },
  setMinMax: (
    state: WritableDraft<TimePickerReduxState>,
    action: PayloadAction<[number, number] | undefined>
  ) => {
    state.componentState.minMax = action.payload;
  },
  setLoading: (state: WritableDraft<TimePickerReduxState>, action: PayloadAction<boolean>) => {
    state.output.loading = action.payload;
  },
  publishFilters: (
    state: WritableDraft<TimePickerReduxState>,
    action: PayloadAction<Filter[] | undefined>
  ) => {
    state.output.filters = action.payload;
  },
  setIsInvalid: (state: WritableDraft<TimePickerReduxState>, action: PayloadAction<boolean>) => {
    state.componentState.isInvalid = action.payload;
  },
};
