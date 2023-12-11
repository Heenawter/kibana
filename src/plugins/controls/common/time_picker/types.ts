/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { DataControlInput } from '../types';

export const TIME_PICKER_CONTROL = 'timePickerControl';

export type TimeValue = [string, string];

export interface TimePickerEmbeddableInput extends DataControlInput {
  value?: TimeValue;
}

export type TimePickerInputWithType = Partial<TimePickerEmbeddableInput> & { type: string };
