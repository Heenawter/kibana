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

import './time_picker.scss';

export const TimePickerControl = () => {
  const timePicker = useTimePicker();

  const {
    settings: { getTimezone },
  } = pluginServices.getServices();

  const selectedStartDate = timePicker.select((state) => state.explicitInput.startDate);
  const selectedEndDate = timePicker.select((state) => state.explicitInput.endDate);
  const singleSelect = timePicker.select((state) => state.explicitInput.singleSelect);
  const loading = timePicker.select((state) => state.output.loading);
  const minMax = timePicker.select((state) => state.componentState.minMax);
  const isInvalid = timePicker.select((state) => state.componentState.isInvalid);

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
      moment.tz(minMax[0], getMomentTimezone(getTimezone())).startOf('day'),
      moment.tz(minMax[1], getMomentTimezone(getTimezone())).endOf('day'),
    ];
  }, [minMax, getTimezone]);

  return singleSelect ? (
    <EuiDatePicker
      fullWidth
      className="timePickerAnchor__buttonSingle"
      placeholder={'Any'}
      shadow={false}
      isLoading={loading}
      showTimeSelect={false}
      showIcon={false}
      popoverPlacement={'downCenter'}
      selected={startDate}
      minDate={minDate}
      maxDate={maxDate}
      allowSameDay={true}
      isInvalid={isInvalid}
      adjustDateOnChange={false}
      onChange={(date) => {
        if (!date) return;
        if (date.isSame(startDate)) {
          timePicker.dispatch.setSingleDate(undefined);
        } else {
          timePicker.dispatch.setSingleDate(date.valueOf());
        }
      }}
    />
  ) : (
    <EuiDatePickerRange
      iconType={false}
      fullWidth
      isInvalid={false}
      isLoading={loading}
      className="timePickerAnchor__buttonDual"
      startDateControl={
        <EuiDatePicker
          isInvalid={isInvalid || (startDate && minDate && startDate < minDate)}
          allowSameDay={true}
          placeholder={minDate?.format('MM/DD/YYYY') ?? 'Any'}
          adjustDateOnChange={false}
          selected={startDate === minDate ? undefined : startDate}
          onChange={(date) => {
            if (!date) return;
            if (date.isSame(startDate) || date.isSame(minDate)) {
              timePicker.dispatch.setStartDate(undefined);
            } else {
              timePicker.dispatch.setStartDate(date.startOf('day').valueOf());
            }
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
          allowSameDay={true}
          isInvalid={isInvalid || (endDate && maxDate && endDate > maxDate)}
          placeholder={maxDate?.format('MM/DD/YYYY') ?? 'Any'}
          adjustDateOnChange={false}
          selected={endDate === maxDate ? undefined : endDate}
          onChange={(date) => {
            if (!date) return;
            if (date.isSame(endDate) || date.isSame(maxDate)) {
              timePicker.dispatch.setEndDate(undefined);
            } else {
              timePicker.dispatch.setEndDate(date.endOf('day').valueOf());
            }
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
