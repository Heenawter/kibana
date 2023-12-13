/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useState } from 'react';

import useMount from 'react-use/lib/useMount';
import { EuiFormRow, EuiRadioGroup } from '@elastic/eui';

import { TimePickerEmbeddableInput } from '../../../common/time_picker/types';
import { ControlEditorProps } from '../../types';

const selectionOptions = [
  {
    id: 'single',
    label: 'Select a single date',
    'data-test-subj': 'timePickerControl__singleSearchOptionAdditionalSetting',
  },
  {
    id: 'multi',
    label: 'Select a range of dates',
    'data-test-subj': 'timePickerControl__multiSearchOptionAdditionalSetting',
  },
];

export const TimePickerEditorOptions = ({
  initialInput,
  onChange,
  fieldType,
}: ControlEditorProps<TimePickerEmbeddableInput>) => {
  const [state, setState] = useState({
    singleSelect: initialInput?.singleSelect ?? true,
  });

  useMount(() => {
    onChange({ singleSelect: initialInput?.singleSelect ?? true });
  });

  return (
    <EuiFormRow label={'Selections'} data-test-subj="timePickerControl__selectionOptionsRadioGroup">
      <EuiRadioGroup
        options={selectionOptions}
        idSelected={state.singleSelect ? 'single' : 'multi'}
        onChange={(id) => {
          const newSingleSelect = id === 'single';
          onChange({ singleSelect: newSingleSelect });
          setState((s) => ({ ...s, singleSelect: newSingleSelect }));
        }}
      />
    </EuiFormRow>
  );
};
