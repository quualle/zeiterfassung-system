import React, { useState, useEffect, useRef } from 'react';

interface EditableTimeCellProps {
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  type?: 'time' | 'text';
  disabled?: boolean;
}

export const EditableTimeCell: React.FC<EditableTimeCellProps> = ({
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  type = 'time',
  disabled = false
}) => {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    } else {
      onCancel();
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    onCancel();
  };

  if (disabled) {
    return <span className="cell-content disabled">{value}</span>;
  }

  if (isEditing) {
    return (
      <div className="editable-cell editing">
        <input
          ref={inputRef}
          type={type === 'time' ? 'time' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="cell-input"
        />
      </div>
    );
  }

  return (
    <div className="editable-cell" onClick={onEdit}>
      <span className="cell-content">{value}</span>
      <span className="edit-icon">✏️</span>
    </div>
  );
};