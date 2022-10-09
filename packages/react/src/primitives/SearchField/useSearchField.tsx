import * as React from 'react';

import { isFunction } from '../shared/utils';
import type { Suggestion, UseSearchFieldProps } from '../types';
import { useComposeRefsCallback } from '../../hooks/useComposeRefsCallback';

const ARROW_UP = 'ArrowUp';
const ARROW_DOWN = 'ArrowDown';
const ESCAPE_KEY = 'Escape';
const ENTER_KEY = 'Enter';
const DEFAULT_KEYS = new Set([ARROW_UP, ARROW_DOWN, ESCAPE_KEY, ENTER_KEY]);

export const useSearchField = ({
  defaultValue,
  value,
  suggestions,
  filteringType,
  onBlur,
  onClear,
  onClick,
  onFocus,
  onInput,
  onSubmit,
  onSuggestionSelect,
  externalRef,
}: UseSearchFieldProps) => {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] =
    React.useState<string>(defaultValue);
  const composedValue = isControlled ? value : internalValue;

  const internalRef = React.useRef<HTMLInputElement>(null);
  const composedRefs = useComposeRefsCallback({ externalRef, internalRef });

  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(-1);

  const filteredSuggestions = React.useMemo(() => {
    const filter =
      filteringType === 'auto'
        ? (suggestion: Suggestion) => {
            const { label } = suggestion;
            return label
              ?.toLocaleLowerCase()
              .includes(composedValue?.toLocaleLowerCase());
          }
        : () => true;
    return suggestions?.filter(filter) || [];
  }, [composedValue, filteringType, suggestions]);

  const onClearHandler = React.useCallback(() => {
    setInternalValue('');
    internalRef?.current?.focus();
    if (isFunction(onClear)) {
      onClear();
    }
  }, [onClear]);

  const onSubmitHandler = React.useCallback(
    (value: string) => {
      if (isFunction(onSubmit)) {
        onSubmit(value);
      }
    },
    [onSubmit]
  );

  const onSearchButtonClick = React.useCallback(() => {
    onSubmitHandler(composedValue);
  }, [onSubmitHandler, composedValue]);

  const handleOnBlur: React.FocusEventHandler<HTMLInputElement> =
    React.useCallback(
      (event) => {
        setIsMenuOpen(false);
        setActiveIdx(-1);
        if (isFunction(onBlur)) {
          onBlur(event);
        }
      },
      [onBlur]
    );

  const handleOnClick: React.MouseEventHandler<HTMLInputElement> =
    React.useCallback(
      (event) => {
        setIsMenuOpen(true);
        if (isFunction(onClick)) {
          onClick(event);
        }
      },
      [onClick]
    );

  const handleOnFocus: React.FocusEventHandler<HTMLInputElement> =
    React.useCallback(
      (event) => {
        setIsMenuOpen(true);
        if (isFunction(onFocus)) {
          onFocus(event);
        }
      },
      [onFocus]
    );

  const handleOnInput = React.useCallback(
    (event) => {
      setActiveIdx(-1);
      setIsMenuOpen(true);
      setInternalValue(event.target.value);
      if (isFunction(onInput)) {
        onInput(event);
      }
    },
    [onInput]
  );

  const handleOnKeyDown: React.KeyboardEventHandler<HTMLInputElement> =
    React.useCallback(
      (event) => {
        const { key } = event;

        if (!DEFAULT_KEYS.has(key)) {
          return;
        }

        event.preventDefault();

        switch (key) {
          case ESCAPE_KEY:
            if (!suggestions) {
              onClearHandler();
              return;
            }
            if (!isMenuOpen) {
              onClearHandler();
              return;
            }
            setIsMenuOpen(false);
            setActiveIdx(-1);
            break;
          case ENTER_KEY:
            const suggestion = filteredSuggestions[activeIdx];
            if (!suggestion) {
              onSubmitHandler(composedValue);
              return;
            }

            const { label } = suggestion;
            if (!isControlled) {
              setInternalValue(label);
            }

            if (isFunction(onSuggestionSelect)) {
              onSuggestionSelect(suggestion);
            }
            setIsMenuOpen(false);
            setActiveIdx(-1);
            break;
          case ARROW_DOWN:
            if (!suggestions) {
              return;
            }
            console.log('key down');
            setIsMenuOpen(true);
            setActiveIdx(
              activeIdx >= filteredSuggestions.length - 1 ? 0 : activeIdx + 1
            );
            break;
          case ARROW_UP:
            if (!suggestions) {
              return;
            }
            setIsMenuOpen(true);
            setActiveIdx(
              activeIdx <= 0 ? filteredSuggestions.length - 1 : activeIdx - 1
            );
        }
      },
      [
        activeIdx,
        composedValue,
        isMenuOpen,
        suggestions,
        filteredSuggestions,
        isControlled,
        onClearHandler,
        onSubmitHandler,
        onSuggestionSelect,
      ]
    );

  return {
    activeIdx,
    filteredSuggestions,
    isControlled,
    composedValue,
    isMenuOpen,
    setActiveIdx,
    setIsMenuOpen,
    setInternalValue,
    onClearHandler,
    handleOnBlur,
    handleOnClick,
    handleOnFocus,
    handleOnInput,
    handleOnKeyDown,
    onSearchButtonClick,
    composedRefs,
  };
};
