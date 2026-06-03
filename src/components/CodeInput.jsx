import React, { useRef } from 'react';

// 6 individual digit boxes for entering a verification code.
// Auto-advances on type, goes back on Backspace, and supports pasting the whole code.
export default function CodeInput({ value = '', onChange, length = 6, autoFocus = true }) {
  const refs = useRef([]);

  const focus = (i) => refs.current[i] && refs.current[i].focus();

  const handleChange = (i, e) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) return;
    const digit = digits[digits.length - 1];
    const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, length);
    onChange(next);
    if (i < length - 1) focus(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1);
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      focus(i + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focus(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="code-input" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="code-box"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
