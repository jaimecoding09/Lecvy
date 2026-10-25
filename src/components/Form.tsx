import { useId, useState, type ChangeEvent, type ReactNode } from 'react'

import {
  AlertIcon,
  AppleMark,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleG,
  InfoIcon,
} from './icons'
import { BrandLogo } from './BrandLogo'
import { isFirebaseConfigured } from '../lib/firebase'

/* -------------------------------------------------------------------------- */
/* Form fields                                                                  */
/* -------------------------------------------------------------------------- */

type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  autoComplete?: string
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  spellCheck?: boolean
  prefix?: string
  error?: string | null
  hint?: string
  disabled?: boolean
  passwordToggle?: boolean
  required?: boolean
  onBlur?: () => void
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  autoCapitalize,
  spellCheck,
  prefix,
  error,
  hint,
  disabled,
  passwordToggle,
  required,
  onBlur,
}: TextFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const [visible, setVisible] = useState(false)

  const isPassword = type === 'password'
  const inputType = isPassword && visible ? 'text' : type
  const hasTrailing = Boolean(passwordToggle) && isPassword

  const className = [
    'input',
    hasTrailing ? 'input--trailing' : '',
    prefix ? 'input--prefixed' : '',
    error ? 'input--error' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const describedBy = error || hint ? messageId : undefined

  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.target.value)
  const handleBlur = () => onBlur?.()

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className="field__control">
        {prefix ? <span className="input-prefix">{prefix}</span> : null}
        <input
          id={id}
          className={className}
          type={inputType}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          spellCheck={spellCheck}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {hasTrailing ? (
          <button
            type="button"
            className="field__toggle"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            tabIndex={0}
          >
            {visible ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="field__message field__message--error" id={messageId}>
          <AlertIcon />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="field__message field__message--hint" id={messageId}>
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                      */
/* -------------------------------------------------------------------------- */

export function PrimaryButton({
  children,
  loading,
  disabled,
  type = 'submit',
  onClick,
}: {
  children: ReactNode
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      className="btn btn--primary"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  loading,
  disabled,
  type = 'button',
  onClick,
}: {
  children: ReactNode
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      className="btn btn--social"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export function SocialButton({
  provider,
  onClick,
  loading,
  disabled,
}: {
  provider: 'google' | 'apple'
  onClick: () => void
  loading?: boolean
  disabled?: boolean
}) {
  const label = provider === 'google' ? 'Continue with Google' : 'Continue with Apple'
  return (
    <button
      type="button"
      className="btn btn--social"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        <span className="btn__icon">
          {provider === 'google' ? <GoogleG size={20} /> : <AppleMark size={19} />}
        </span>
      )}
      {label}
    </button>
  )
}

export function TextButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className="btn btn--text" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function OrDivider() {
  return (
    <div className="divider" role="separator" aria-label="or">
      OR
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Notices                                                                      */
/* -------------------------------------------------------------------------- */

export function Notice({
  kind,
  title,
  children,
}: {
  kind: 'error' | 'success' | 'info'
  title?: string
  children: ReactNode
}) {
  const icon =
    kind === 'error' ? (
      <AlertIcon />
    ) : kind === 'success' ? (
      <CheckCircleIcon />
    ) : (
      <InfoIcon />
    )
  return (
    <div
      className={`notice notice--${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {icon}
      <span>
        {title ? <strong className="notice__title">{title}</strong> : null}
        {children}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Auth shell                                                                   */
/* -------------------------------------------------------------------------- */

export function AuthLayout({
  children,
  showBrand = true,
}: {
  children: ReactNode
  showBrand?: boolean
}) {
  return (
    <main className="auth-page">
      <div className="auth">
        {showBrand ? (
          <div className="auth__brand">
            <BrandLogo size="lg" />
          </div>
        ) : null}
        {!isFirebaseConfigured ? (
          <Notice kind="info" title="Setup required">
            Firebase web config is missing. Copy <b>.env.example</b> to{' '}
            <b>.env</b>, fill in the values, and restart the dev server.
          </Notice>
        ) : null}
        {children}
      </div>
    </main>
  )
}
