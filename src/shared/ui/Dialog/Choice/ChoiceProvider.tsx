'use client';

import { useCallback } from 'react';
import { useDialog } from '../useDialog';
import { DialogBase } from '../shared';
import ChoiceContent from './ChoiceContent';

/**
 * ChoiceProvider - 글로벌 Choice 다이얼로그 렌더러
 * - 루트 레이아웃에 배치
 * - Promise 기반 API 지원
 * - HTML5 <dialog> + form method="dialog" 패턴 사용
 */
const ChoiceProvider = () => {
  const { choiceIsOpen, choiceOptions, resolveChoice } = useDialog();

  const handleClose = useCallback(() => {
    resolveChoice(null);
  }, [resolveChoice]);

  const handleCloseWithValue = useCallback(
    (value: string) => {
      resolveChoice(value);
    },
    [resolveChoice],
  );

  if (!choiceIsOpen || !choiceOptions) return null;

  return (
    <DialogBase
      isOpen={choiceIsOpen}
      onClose={handleClose}
      onCloseWithValue={handleCloseWithValue}
      ariaLabelledBy="choice-dialog-title"
      ariaDescribedBy={choiceOptions.description ? 'choice-dialog-description' : undefined}
      role="dialog"
    >
      <ChoiceContent options={choiceOptions} onClose={handleClose} />
    </DialogBase>
  );
};

export default ChoiceProvider;
