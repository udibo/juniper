import { CustomError } from "@/utils/error.ts";

export default function CustomErrorPage() {
  console.log("CustomErrorPage render");
  if (Math.random() > 0.5) {
    throw new CustomError("This is a custom error", true);
  }
  return <div>No error</div>;
}
