/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { FieldSpec } from '@kbn/data-views-plugin/common';
import type { ReduxEmbeddableState } from '@kbn/presentation-util-plugin/public';

import { TimePickerEmbeddableInput } from '../../common/time_picker/types';
import { ControlOutput } from '../types';

// Component state is only used by public components.
export interface TimePickerComponentState {
  field?: FieldSpec;
  error?: string;
  isInvalid?: boolean;

  minMax?: [number, number];
}

// public only - redux embeddable state type
export type TimePickerReduxState = ReduxEmbeddableState<
  TimePickerEmbeddableInput,
  ControlOutput,
  TimePickerComponentState
>;
