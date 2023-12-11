/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export type { RangeSliderEmbeddableInput } from '../../common/range_slider/types';
export { RANGE_SLIDER_CONTROL } from '../../common/range_slider/types';

export type { TimePickerEmbeddable as RangeSliderEmbeddable } from './embeddable/time_picker_embeddable';
export { TimePickerEmbeddableFactory as RangeSliderEmbeddableFactory } from './embeddable/time_picker_embeddable_factory';
