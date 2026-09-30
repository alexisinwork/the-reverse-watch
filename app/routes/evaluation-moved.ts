import { redirect } from "react-router";

/** /evaluation moved behind the admin login. */
export function loader() {
  return redirect("/admin/evaluation", 301);
}
