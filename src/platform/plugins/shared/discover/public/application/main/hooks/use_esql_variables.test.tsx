/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ControlPanelsState, ControlGroupRendererApi } from '@kbn/controls-plugin/public';
import { BehaviorSubject, Observable } from 'rxjs';
import { DiscoverTestProvider } from '../../../__mocks__/test_provider';
import { getDiscoverStateMock } from '../../../__mocks__/discover_state.mock';
import { mockControlState } from '../../../__mocks__/esql_controls';
import { useESQLVariables } from './use_esql_variables';
import type { ESQLControlState, ESQLControlVariable } from '@kbn/esql-types';
import type { DiscoverStateContainer } from '../state_management/discover_state';
import React from 'react';

// Mock ControlGroupRendererApi
class MockControlGroupRendererApi {
  inputSubject: BehaviorSubject<Record<string, ControlPanelsState<ESQLControlState>> | null>;
  addNewPanel: jest.Mock;

  constructor() {
    this.inputSubject = new BehaviorSubject<Record<
      string,
      ControlPanelsState<ESQLControlState>
    > | null>(null);
    this.addNewPanel = jest.fn();
  }

  getInput$() {
    return this.inputSubject.asObservable();
  }

  // Method to simulate new input coming from the API
  simulateInput(input: Record<string, ControlPanelsState<ESQLControlState>>) {
    this.inputSubject.next(input);
  }
}

// --- Test Suite ---
describe('useESQLVariables', () => {
  let mockControlGroupAPI: MockControlGroupRendererApi;
  const getStateContainer = () => {
    const stateContainer = getDiscoverStateMock({ isTimeBased: true });
    stateContainer.appState.update({
      interval: 'auto',
      hideChart: false,
    });
    const appState = stateContainer.appState;
    const wrappedStateContainer = Object.create(appState);
    wrappedStateContainer.update = jest.fn((newState) => appState.update(newState));
    stateContainer.appState = wrappedStateContainer;
    return stateContainer;
  };

  const renderUseESQLVariables = async ({
    stateContainer = getStateContainer(),
    isEsqlMode = true,
    controlGroupAPI = mockControlGroupAPI as unknown as ControlGroupRendererApi,
    currentEsqlVariables = [],
    onTextLangQueryChange = jest.fn(),
  }: {
    stateContainer?: DiscoverStateContainer;
    isEsqlMode?: boolean;
    controlGroupAPI?: ControlGroupRendererApi;
    currentEsqlVariables?: ESQLControlVariable[];
    onTextLangQueryChange?: (query: string) => void;
  }) => {
    const Wrapper = ({ children }: React.PropsWithChildren<unknown>) => (
      <DiscoverTestProvider stateContainer={stateContainer}>{children}</DiscoverTestProvider>
    );

    const hook = renderHook(
      () =>
        useESQLVariables({
          stateContainer,
          isEsqlMode,
          controlGroupAPI,
          currentEsqlVariables,
          onTextLangQueryChange,
        }),
      {
        wrapper: Wrapper,
      }
    );

    await act(() => setTimeout(() => {}, 0));

    return { hook };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockControlGroupAPI = new MockControlGroupRendererApi();
  });

  it('should initialize and return handler functions', async () => {
    const { hook } = await renderUseESQLVariables({});

    expect(hook.result.current.onSaveControl).toBeInstanceOf(Function);
    expect(hook.result.current.getActivePanels).toBeInstanceOf(Function);
  });

  describe('useEffect for ControlGroupAPI input', () => {
    it('should not subscribe if not in ESQL mode or controlGroupAPI is missing', async () => {
      const stateContainer = getStateContainer();
      const mockedStateContainer = {
        ...stateContainer,
        internalState: {
          ...stateContainer.internalState,
          dispatch: jest.fn(),
        },
      };
      const { hook } = await renderUseESQLVariables({
        isEsqlMode: false,
        stateContainer: mockedStateContainer,
      });

      // Try to simulate input, it should not trigger any dispatch
      act(() => {
        mockControlGroupAPI.simulateInput({
          initialChildControlState: {
            '123': { type: 'esqlControl' },
          } as unknown as ControlPanelsState<ESQLControlState>,
        });
      });

      expect(mockedStateContainer.internalState.dispatch).not.toHaveBeenCalled();
      hook.unmount();
    });

    it('should update Redux state when initialChildControlState is received and variables change', async () => {
      const mockNewVariables = [
        { key: 'foo', type: 'values', value: 'bar' },
      ] as ESQLControlVariable[];

      const stateContainer = getStateContainer();
      const mockedStateContainer = {
        ...stateContainer,
        internalState: {
          ...stateContainer.internalState,
          dispatch: jest.fn(),
        },
        savedSearchState: {
          ...stateContainer.savedSearchState,
          updateControlState: jest.fn(),
        },
        dataState: {
          ...stateContainer.dataState,
          fetch: jest.fn(),
        },
      };
      await renderUseESQLVariables({
        isEsqlMode: true,
        stateContainer: mockedStateContainer,
      });

      // Simulate initial input from controlGroupAPI
      act(() => {
        mockControlGroupAPI.simulateInput({ initialChildControlState: mockControlState });
      });

      // Assert dispatches happened
      await waitFor(() => {
        expect(mockedStateContainer.internalState.dispatch).toHaveBeenCalledTimes(2);
        mockedStateContainer.internalState.dispatch.mock.calls.filter((call) => {
          if (call[0].type === 'internalState/setControlGroupState') {
            expect(call[0].payload.controlGroupState).toEqual(mockControlState);
          }
          if (call[0].type === 'internalState/setEsqlVariables') {
            expect(call[0].payload).toEqual(mockNewVariables);
          }
        });
      });

      await waitFor(() => {
        expect(mockedStateContainer.savedSearchState.updateControlState).toHaveBeenCalledWith({
          nextControlState: mockControlState,
        });
      });

      await waitFor(() => {
        expect(mockedStateContainer.dataState.fetch).toHaveBeenCalled();
      });
    });

    it('should unsubscribe on unmount', async () => {
      const mockUnsubscribe = jest.fn();
      jest.spyOn(mockControlGroupAPI.inputSubject, 'asObservable').mockReturnValue(
        new Observable((subscriber) => {
          return () => mockUnsubscribe();
        })
      );

      const { hook } = await renderUseESQLVariables({
        isEsqlMode: true,
      });

      act(() => {
        hook.unmount();
      });

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('onSaveControl', () => {
    it('should call addNewPanel and onTextLangQueryChange', async () => {
      const mockOnTextLangQueryChange = jest.fn();
      const mockUpdatedQuery = 'new query text';

      const { hook } = await renderUseESQLVariables({
        isEsqlMode: true,
        onTextLangQueryChange: mockOnTextLangQueryChange,
      });

      await act(async () => {
        await hook.result.current.onSaveControl(mockControlState, mockUpdatedQuery);
      });

      expect(mockControlGroupAPI.addNewPanel).toHaveBeenCalledTimes(1);
      expect(mockControlGroupAPI.addNewPanel).toHaveBeenCalledWith({
        panelType: 'esqlControl',
        serializedState: {
          rawState: {
            ...mockControlState,
          },
        },
      });
      expect(mockOnTextLangQueryChange).toHaveBeenCalledTimes(1);
      expect(mockOnTextLangQueryChange).toHaveBeenCalledWith(mockUpdatedQuery);
    });

    it('should not call onTextLangQueryChange if updatedQuery is empty', async () => {
      const mockOnTextLangQueryChange = jest.fn();

      const { hook } = await renderUseESQLVariables({
        isEsqlMode: true,
        onTextLangQueryChange: mockOnTextLangQueryChange,
      });

      await act(async () => {
        await hook.result.current.onSaveControl(mockControlState, ''); // Empty query
      });

      expect(mockControlGroupAPI.addNewPanel).toHaveBeenCalledTimes(1);
      expect(mockOnTextLangQueryChange).not.toHaveBeenCalled();
    });
  });

  describe('getActivePanels', () => {
    it('should return currentTab.controlGroupState if available and not empty', async () => {
      const { hook } = await renderUseESQLVariables({
        isEsqlMode: true,
      });

      act(() => {
        mockControlGroupAPI.simulateInput({ initialChildControlState: mockControlState });
      });

      const activePanels = hook.result.current.getActivePanels();
      expect(activePanels).toEqual(mockControlState);
    });

    it('should return undefined if both currentTab.controlGroupState and savedSearchState.controlGroupJson are empty/invalid', async () => {
      const { hook } = await renderUseESQLVariables({
        isEsqlMode: true,
      });

      const activePanels = hook.result.current.getActivePanels();
      expect(activePanels).toEqual({}); // JSON.parse('{}') results in an empty object
    });
  });
});
