import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Performs a deep equality check between two objects using JSON stringification.
 * This is a simple utility function and may not handle all edge cases (e.g., circular references).
 *
 * @param obj1 - The first object to compare.
 * @param obj2 - The second object to compare.
 * @returns `true` if the objects are deeply equal, otherwise `false`.
 */
function simpleJsonDeepEqual(obj1: unknown, obj2: unknown): boolean {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== typeof obj2 || obj1 === null || obj2 === null) return false;
    if (typeof obj1 !== 'object') return false;

    try {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    } catch (e) {
        console.error("Error during deepEqual stringification:", e);
        return false;
    }
}

/**
 * A custom React hook for managing form state that synchronizes with initial values.
 * This hook is useful for forms where the initial values may change over time and need to be reflected in the form state.
 *
 * @template T - The type of the form state object.
 * @param initialValues - The initial values for the form. Can be `null`, `undefined`, or a partial object of type `T`.
 * @param defaultValues - The default values for the form. This is used as a fallback for any missing fields in `initialValues`.
 * @returns An object containing:
 * - `values`: The current form state.
 * - `setValues`: A function to manually update the form state.
 * - `handleChange`: A function to update a specific field in the form state.
 * - `resetForm`: A function to reset the form state to the initial or default values.
 */
export function useSyncedFormState<T extends object>(
    initialValues: Partial<T> | null | undefined,
    defaultValues: T 
) {
  /**
   * The current state of the form, initialized with a combination of default values and initial values.
   */
  const [formState, setFormState] = useState<T>(() => {
    return { ...defaultValues, ...(initialValues || {}) };
  });

  /**
   * A ref to store the previous `initialValues` prop to detect changes.
   */
  const prevInitialValuesRef = useRef(initialValues);

  useEffect(() => {
    // Sync the form state if `initialValues` changes and is not deeply equal to the previous value.
    if (!simpleJsonDeepEqual(initialValues, prevInitialValuesRef.current)) {
      console.log("useSyncedFormState: Syncing state from new initialValues prop", initialValues);
      setFormState({ ...defaultValues, ...(initialValues || {}) });
      prevInitialValuesRef.current = initialValues;
    }
  }, [initialValues, defaultValues]); 

  /**
   * Updates a specific field in the form state.
   *
   * @param fieldName - The name of the field to update.
   * @param value - The new value for the field.
   */
  const handleChange = useCallback((fieldName: keyof T, value: unknown) => {
    setFormState(prevState => ({
      ...prevState,
      [fieldName]: value
    }));
  }, []);

  /**
   * Resets the form state to the initial or default values.
   */
  const resetForm = useCallback(() => {
     setFormState({ ...defaultValues, ...(initialValues || {}) });
     prevInitialValuesRef.current = initialValues;
  }, [initialValues, defaultValues]);

  return {
    values: formState,
    setValues: setFormState,
    handleChange,
    resetForm
  };
}