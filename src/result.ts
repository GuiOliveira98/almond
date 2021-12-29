type Success<T> = { result: "ok"; value: T };
type Error<T> = { result: "error"; error: T };

export type Result<SuccessType, ErrorType> =
  | Success<SuccessType>
  | Error<ErrorType>;

export function Err<ErrorType>(error: ErrorType): Error<ErrorType> {
  return { result: "error", error };
}

export function Ok<SuccessType>(value: SuccessType): Success<SuccessType> {
  return { result: "ok", value };
}
