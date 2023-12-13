/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { EuiDatePicker, EuiDatePickerRange } from '@elastic/eui';
import moment, { Moment } from 'moment-timezone';
import React, { useMemo } from 'react';
import { pluginServices } from '../../services';
import { getMomentTimezone } from '../../time_slider/time_utils';
import { useTimePicker } from '../embeddable/time_picker_embeddable';

export const TimePickerControl = () => {
  const timePicker = useTimePicker();

  const {
    settings: { getTimezone },
  } = pluginServices.getServices();

  const selectedStartDate = timePicker.select((state) => state.explicitInput.startDate);
  const selectedEndDate = timePicker.select((state) => state.explicitInput.endDate);
  const singleSelect = timePicker.select((state) => state.explicitInput.singleSelect);
  const minMax = timePicker.select((state) => state.componentState.minMax);

  const startDate: Moment | undefined = useMemo(() => {
    return selectedStartDate && selectedStartDate !== minMax?.[0]
      ? moment(selectedStartDate)
      : undefined;
  }, [selectedStartDate, minMax]);

  const endDate: Moment | undefined = useMemo(() => {
    return selectedEndDate && selectedEndDate !== minMax?.[1] ? moment(selectedEndDate) : undefined;
  }, [selectedEndDate, minMax]);

  const [minDate, maxDate] = useMemo(() => {
    if (!minMax) return [undefined, undefined];

    return [
      moment.tz(minMax[0], getMomentTimezone(getTimezone())),
      moment.tz(minMax[1], getMomentTimezone(getTimezone())),
    ];
  }, [minMax, getTimezone]);

  const isInvalid = useMemo(() => {
    if (!startDate || !endDate || !minDate || !maxDate) return false;
    return (
      startDate > endDate || startDate < minDate.startOf('day') || endDate > maxDate.endOf('day')
    );
  }, [startDate, endDate, minDate, maxDate]);

  return singleSelect ? (
    <EuiDatePicker
      showTimeSelect={false}
      showIcon={false}
      selected={startDate ?? minDate}
      minDate={minDate}
      maxDate={maxDate}
      adjustDateOnChange={false}
      onChange={(date) => {
        if (!date) return;
        timePicker.dispatch.setSingleDate(date.valueOf());
        // timePicker.dispatch.setStartDate(date.startOf('day').valueOf());
        // timePicker.dispatch.setEndDate(date.endOf('day').valueOf());
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
          onChange={(date) => {
            if (!date) return;
            timePicker.dispatch.setStartDate(date.startOf('day').valueOf());
          }}
          startDate={startDate ?? minDate}
          endDate={endDate ?? maxDate}
          minDate={minDate}
          maxDate={maxDate}
          aria-label="Start date"
          showTimeSelect={false}
        />
      }
      endDateControl={
        <EuiDatePicker
          adjustDateOnChange={false}
          selected={endDate ?? maxDate}
          onChange={(date) => {
            if (!date) return;
            timePicker.dispatch.setEndDate(date.endOf('day').valueOf());
          }}
          startDate={startDate ?? minDate}
          endDate={endDate ?? maxDate}
          minDate={minDate}
          maxDate={maxDate}
          aria-label="End date"
          showTimeSelect={false}
        />
      }
    />
  );
};
