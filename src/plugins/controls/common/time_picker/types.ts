/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { DataView, FieldSpec, RuntimeFieldSpec } from '@kbn/data-views-plugin/common';
import { BoolQuery, Filter, Query, TimeRange } from '@kbn/es-query';
import { DataControlInput } from '../types';

export const TIME_PICKER_CONTROL = 'timePickerControl';

export type TimeValue = [string, string];

export interface TimePickerEmbeddableInput extends DataControlInput {
  value?: TimeValue;
  singleSelect?: boolean;
}

export type TimePickerInputWithType = Partial<TimePickerEmbeddableInput> & { type: string };

export interface TimePickerRequestBody {
  filters?: Array<{ bool: BoolQuery }>;
  fieldSpec?: FieldSpec;
  fieldName: string;
  runtimeFieldMap?: Record<string, RuntimeFieldSpec>;
  runPastTimeout?: boolean;
}

export type TimePickerRequest = Omit<
  TimePickerRequestBody,
  'filters' | 'fieldName' | 'fieldSpec' | 'textFieldName'
> & {
  timeRange?: TimeRange;
  dataView: DataView;
  filters?: Filter[];
  field: FieldSpec;
  query?: Query;
};

export interface TimePickerSuccessResponse {
  min: number;
  max: number;
}

export interface TimePickerFailureResponse {
  error: 'aborted' | Error;
}

export type TimePickerResponse = TimePickerSuccessResponse | TimePickerFailureResponse;
