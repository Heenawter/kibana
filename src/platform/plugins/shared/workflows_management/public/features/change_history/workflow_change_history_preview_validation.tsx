/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect } from 'react';
import type { ChangeHistoryPreviewValidationContext } from '@kbn/change-history-ui';
import { useWorkflowChangeHistoryPreviewValidation } from './use_workflow_change_history_preview_validation';
import { WorkflowChangeHistoryPreviewFooter } from './workflow_change_history_preview_footer';
import { clearWorkflowYamlComputationCache } from '../validate_workflow_yaml/lib/workflow_yaml_computation_cache';

export interface WorkflowChangeHistoryPreviewValidationProps {
  context: ChangeHistoryPreviewValidationContext;
  /** YAML validated in the preview. */
  validationYaml: string;
}

/** Runs workflow YAML validation against the shared preview editors and renders the results footer. */
export const WorkflowChangeHistoryPreviewValidation = ({
  context,
  validationYaml,
}: WorkflowChangeHistoryPreviewValidationProps): JSX.Element | null => {
  const { highlightValidationErrors, isEditorMounted } = context;
  const { validationResults, isValidationLoading, validationError, handleValidationErrorClick } =
    useWorkflowChangeHistoryPreviewValidation({ ...context, validationYaml });

  useEffect(() => () => clearWorkflowYamlComputationCache(), []);

  if (!highlightValidationErrors) {
    return null;
  }

  return (
    <WorkflowChangeHistoryPreviewFooter
      validationResults={validationResults}
      isEditorMounted={isEditorMounted}
      isValidationLoading={isValidationLoading}
      validationError={validationError}
      onValidationErrorClick={handleValidationErrorClick}
    />
  );
};
