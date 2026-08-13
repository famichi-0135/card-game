import { toast } from "../../../components/ui/toast.tsx";

export function notifyMatchmakingError({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  toast.add({ description, title, type: "error" });
}
