import { CustomError } from "/utils/error.ts";

export default function CustomErrorPage() {
  if (Math.random() > -1) {
    throw new CustomError("This is a custom error", true);
  }
  return <div>No error</div>;
}
