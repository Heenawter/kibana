/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { EuiDatePicker, EuiDatePickerRange } from '@elastic/eui';
import moment, { Moment } from 'moment';
import React, { useMemo, useState } from 'react';
import { useTimePicker } from '../embeddable/time_picker_embeddable';

export const TimePickerControl = () => {
  const timePicker = useTimePicker();

  const singleSelect = timePicker.select((state) => state.explicitInput.singleSelect);
  const minMax = timePicker.select((state) => state.componentState.minMax);

  const [startDate, setStartDate] = useState<Moment | undefined>(undefined);
  const [endDate, setEndDate] = useState<Moment | undefined>(undefined);

  const [minDate, maxDate] = useMemo(() => {
    if (!minMax) return [undefined, undefined];
    return [moment(minMax[0]), moment(minMax[1])];
  }, [minMax]);

  const isInvalid = useMemo(() => {
    if (!startDate || !endDate || !minDate || !maxDate) return false;
    return startDate > endDate || startDate < minDate || endDate > maxDate;
  }, [startDate, endDate, minDate, maxDate]);

  return singleSelect ? (
    <EuiDatePicker
      showTimeSelect
      showIcon={false}
      selected={startDate ?? minDate}
      minDate={minDate}
      maxDate={maxDate}
      adjustDateOnChange={false}
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
          adjustDateOnChange={false}
          selected={startDate ?? minDate}
          onChange={(date) => date && setStartDate(date)}
          startDate={startDate ?? minDate}
          endDate={endDate ?? maxDate}
          minDate={minDate}
          maxDate={maxDate}
          aria-label="Start date"
          showTimeSelect
        />
      }
      endDateControl={
        <EuiDatePicker
          adjustDateOnChange={false}
          selected={endDate ?? maxDate}
          onChange={(date) => date && setEndDate(date)}
          startDate={startDate ?? minDate}
          endDate={endDate ?? maxDate}
          minDate={minDate}
          maxDate={maxDate}
          aria-label="End date"
          showTimeSelect
        />
      }
    />
  );
};
