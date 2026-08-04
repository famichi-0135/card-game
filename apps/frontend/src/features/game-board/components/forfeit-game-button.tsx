import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ForfeitGameButton({
  disabled,
  onForfeit,
}: {
  disabled: boolean;
  onForfeit: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button disabled={disabled} variant="destructive" />}
      >
        対戦を中止する
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>対戦を中止しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作を行うとあなたの敗北でゲームが終了します。取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            onClick={onForfeit}
            variant="destructive"
          >
            中止して敗北する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
