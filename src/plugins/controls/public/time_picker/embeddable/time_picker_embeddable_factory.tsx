/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { i18n } from '@kbn/i18n';
import deepEqual from 'fast-deep-equal';

import { DataViewField } from '@kbn/data-views-plugin/common';
import { lazyLoadReduxToolsPackage } from '@kbn/presentation-util-plugin/public';
import { EmbeddableFactoryDefinition, IContainer } from '@kbn/embeddable-plugin/public';

import {
  createTimePickerExtract,
  createTimePickerInject,
} from '../../../common/time_picker/time_picker_persistable_state';
import { TimePickerEmbeddableInput, TIME_PICKER_CONTROL } from '../../../common/time_picker/types';
import { ControlEmbeddable, IEditableControlFactory } from '../../types';
import { TimePickerEditorOptions } from '../components/time_picker_editor_options';

export class TimePickerEmbeddableFactory
  implements EmbeddableFactoryDefinition, IEditableControlFactory<TimePickerEmbeddableInput>
{
  public type = TIME_PICKER_CONTROL;

  public getDisplayName = () =>
    i18n.translate('controls.timePicker.displayName', {
      defaultMessage: 'Date picker',
    });

  public getDescription = () =>
    i18n.translate('controls.timePicker.description', {
      defaultMessage: 'Add a control for selecting dates.',
    });

  public getIconType = () => 'calendar';

  public canCreateNew = () => false;

  public isEditable = () => Promise.resolve(true);

  public async create(initialInput: TimePickerEmbeddableInput, parent?: IContainer) {
    const reduxEmbeddablePackage = await lazyLoadReduxToolsPackage();
    const { TimePickerEmbeddable: TimePickerEmbeddable } = await import('./time_picker_embeddable');

    return Promise.resolve(
      new TimePickerEmbeddable(reduxEmbeddablePackage, initialInput, {}, parent)
    );
  }

  public controlEditorOptionsComponent = TimePickerEditorOptions;

  public presaveTransformFunction = (
    newInput: Partial<TimePickerEmbeddableInput>,
    embeddable?: ControlEmbeddable<TimePickerEmbeddableInput>
  ) => {
    if (
      embeddable &&
      ((newInput.fieldName && !deepEqual(newInput.fieldName, embeddable.getInput().fieldName)) ||
        (newInput.dataViewId && !deepEqual(newInput.dataViewId, embeddable.getInput().dataViewId)))
    ) {
      // if the field name or data view id has changed in this editing session, selected values are invalid, so reset them.
      newInput.value = ['', ''];
    }

    return newInput;
  };

  public isFieldCompatible = (field: DataViewField) => {
    return field.aggregatable && field.type === 'date';
  };

  public inject = createTimePickerInject();
  public extract = createTimePickerExtract();
}
