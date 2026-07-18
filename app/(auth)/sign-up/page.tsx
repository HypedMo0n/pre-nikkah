import { redirect } from "next/navigation";

export default function SignUpPage() {
  redirect("/en/sign-up?mode=create");
}
