export type ValidationFailure = {
  ok: false;
  code: string;
  detail?: string;
};

export type ValidationSuccess<T> = {
  ok: true;
  value: T;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function fail(code: string, detail?: string): ValidationFailure {
  return detail === undefined ? { ok: false, code } : { ok: false, code, detail };
}
