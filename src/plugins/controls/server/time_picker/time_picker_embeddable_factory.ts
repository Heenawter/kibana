/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { TIME_PICKER_CONTROL } from '@kbn/controls-plugin/common/time_picker/types';
import { EmbeddableRegistryDefinition } from '@kbn/embeddable-plugin/server';

import {
  createTimePickerExtract,
  createTimePickerInject,
} from '../../common/time_picker/time_picker_persistable_state';

export const timePickerPersistableStateServiceFactory = (): EmbeddableRegistryDefinition => {
  return {
    id: TIME_PICKER_CONTROL,
    extract: createTimePickerExtract(),
    inject: createTimePickerInject(),
  };
};
