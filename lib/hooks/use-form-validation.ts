"use client"

import { useState, useCallback } from "react"

export interface ValidationRule {
  validator: (value: string) => boolean
  message: string
}

export interface FieldValidation {
  [key: string]: ValidationRule[]
}

export interface ValidationErrors {
  [key: string]: string | undefined
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  rules: FieldValidation
) {
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = useCallback(
    (name: string, value: string) => {
      const fieldRules = rules[name]
      if (!fieldRules) return undefined

      for (const rule of fieldRules) {
        if (!rule.validator(value)) {
          return rule.message
        }
      }
      return undefined
    },
    [rules]
  )

  const validateForm = useCallback(
    (values: T): boolean => {
      const newErrors: ValidationErrors = {}
      let isValid = true

      Object.keys(rules).forEach((field) => {
        const error = validateField(field, values[field] || "")
        if (error) {
          newErrors[field] = error
          isValid = false
        }
      })

      setErrors(newErrors)
      return isValid
    },
    [rules, validateField]
  )

  const handleBlur = useCallback(
    (name: string) => {
      setTouched((prev) => ({ ...prev, [name]: true }))
    },
    []
  )

  const handleChange = useCallback(
    (name: string, value: string, formValues: T) => {
      // Clear error when user starts typing
      if (errors[name]) {
        const error = validateField(name, value)
        setErrors((prev) => ({ ...prev, [name]: error }))
      }
    },
    [errors, validateField]
  )

  const setFieldError = useCallback((name: string, error: string | undefined) => {
    setErrors((prev) => ({ ...prev, [name]: error }))
  }, [])

  const clearErrors = useCallback(() => {
    setErrors({})
    setTouched({})
  }, [])

  return {
    errors,
    touched,
    validateField,
    validateForm,
    handleBlur,
    handleChange,
    setFieldError,
    clearErrors,
  }
}

// Common validation rules
export const commonRules = {
  required: (message = "This field is required"): ValidationRule => ({
    validator: (value) => value.trim().length > 0,
    message,
  }),
  minLength: (min: number, message?: string): ValidationRule => ({
    validator: (value) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),
  maxLength: (max: number, message?: string): ValidationRule => ({
    validator: (value) => value.length <= max,
    message: message || `Must be no more than ${max} characters`,
  }),
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validator: (value) => !value || regex.test(value),
    message,
  }),
  email: (message = "Invalid email address"): ValidationRule => ({
    validator: (value) =>
      !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),
  url: (message = "Invalid URL"): ValidationRule => ({
    validator: (value) =>
      !value ||
      /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/.test(
        value
      ),
    message,
  }),
}

