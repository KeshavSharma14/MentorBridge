import { useState, type KeyboardEvent } from 'react'

interface TagEditorProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function TagEditor({ label, values, onChange, placeholder }: TagEditorProps) {
  const [draft, setDraft] = useState('')

  function addTag() {
    const value = draft.trim()
    if (value && !values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value])
    }
    setDraft('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="tag-editor">
        {values.map((value) => (
          <span className="tag" key={value}>
            {value}
            <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Remove ${value}`}>
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
