import { isSerializedError, type SerializedError } from "@udibo/juniper/client";

/**
 * This is an example of a custom error used to demonstrate how to serialize and deserialize errors.
 * This is not needed for global error types supported by browsers or the HttpError class used by Juniper.
 */
export class CustomError extends Error {
  exposeStack: boolean;
  constructor(message: string, exposeStack: boolean = false) {
    super(message);
    this.exposeStack = exposeStack;
  }
}

export interface SerializedCustomError extends SerializedError {
  __subType: "CustomError";
  message: string;
  exposeStack: boolean;
}

export function isSerializedCustomError(
  serializedError: unknown,
): serializedError is SerializedCustomError {
  return isSerializedError(serializedError) &&
    serializedError.__type === "Error" &&
    serializedError.__subType === "CustomError";
}
