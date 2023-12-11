/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import {
  EmbeddableStateWithType,
  EmbeddablePersistableStateService,
} from '@kbn/embeddable-plugin/common';
import { SavedObjectReference } from '@kbn/core/types';
import { DATA_VIEW_SAVED_OBJECT_TYPE } from '@kbn/data-views-plugin/common';
import { TimePickerInputWithType } from './types';

const dataViewReferenceName = 'rangeSliderDataView';

export const createTimePickerInject = (): EmbeddablePersistableStateService['inject'] => {
  return (state: EmbeddableStateWithType, references: SavedObjectReference[]) => {
    const workingState = { ...state } as EmbeddableStateWithType | TimePickerInputWithType;
    references.forEach((reference) => {
      if (reference.name === dataViewReferenceName) {
        (workingState as TimePickerInputWithType).dataViewId = reference.id;
      }
    });
    return workingState as EmbeddableStateWithType;
  };
};

export const createTimePickerExtract = (): EmbeddablePersistableStateService['extract'] => {
  return (state: EmbeddableStateWithType) => {
    const workingState = { ...state } as EmbeddableStateWithType | TimePickerInputWithType;
    const references: SavedObjectReference[] = [];

    if ('dataViewId' in workingState) {
      references.push({
        name: dataViewReferenceName,
        type: DATA_VIEW_SAVED_OBJECT_TYPE,
        id: workingState.dataViewId!,
      });
      delete workingState.dataViewId;
    }
    return { state: workingState as EmbeddableStateWithType, references };
  };
};
