/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { EuiDatePicker, EuiDatePickerRange } from '@elastic/eui';
import moment from 'moment';
import React, { useState } from 'react';
import { useTimePicker } from '../embeddable/time_picker_embeddable';

export const TimePickerControl = () => {
  const timePicker = useTimePicker();

  const minDate = moment().subtract(2, 'y');
  const maxDate = moment();
  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(maxDate);

  const isInvalid = startDate > endDate || startDate < minDate || endDate > maxDate;

  const singleSelect = timePicker.select((state) => state.explicitInput.singleSelect);

  return singleSelect ? (
    <EuiDatePicker
      showTimeSelect
      showIcon={false}
      selected={startDate}
      onChange={(date) => {
        if (!date) return;
        setStartDate(date);
        setEndDate(date);
      }}
    />
  ) : (
    <EuiDatePickerRange
      iconType={false}
      isInvalid={isInvalid}
      startDateControl={
        <EuiDatePicker
          selected={startDate}
          onChange={(date) => date && setStartDate(date)}
          startDate={startDate}
          endDate={endDate}
          minDate={minDate}
          maxDate={endDate}
          aria-label="Start date"
          showTimeSelect
        />
      }
      endDateControl={
        <EuiDatePicker
          selected={endDate}
          onChange={(date) => date && setEndDate(date)}
          startDate={startDate}
          endDate={endDate}
          minDate={startDate}
          maxDate={maxDate}
          aria-label="End date"
          showTimeSelect
        />
      }
    />
  );
};
