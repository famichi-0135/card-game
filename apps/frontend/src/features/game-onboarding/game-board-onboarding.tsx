import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../game-board/hooks/use-prefers-reduced-motion.ts";
import { GameBoardOnboardingPreview } from "./game-board-onboarding-preview.tsx";
import { gameBoardOnboardingSteps } from "./game-board-onboarding-steps.ts";

export type OnboardingResult = "completed" | "skipped" | "interrupted";

export function GameBoardOnboarding({
  onFinish,
}: {
  onFinish: (result: OnboardingResult) => void;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    let disposed = false;
    let driverInstance: { destroy: () => void } | undefined;
    let reported = false;
    let userResult: "completed" | "skipped" | null = null;

    const reportFinish = (result: OnboardingResult) => {
      if (reported) {
        return;
      }
      reported = true;
      finishRef.current(result);
    };

    void (async () => {
      const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
      ]);
      if (disposed) {
        return;
      }

      const instance = driver({
        allowClose: true,
        allowKeyboardControl: true,
        animate: !prefersReducedMotion,
        disableActiveInteraction: true,
        doneBtnText: "完了",
        nextBtnText: "次へ",
        onDestroyed: () => {
          if (disposed) {
            reportFinish("interrupted");
          } else {
            reportFinish(userResult ?? "skipped");
          }
        },
        onDoneClick: () => {
          userResult = "completed";
          instance.destroy();
        },
        onPopoverRender: (popover) => {
          popover.closeButton.setAttribute("aria-label", "スキップ");
          popover.closeButton.title = "スキップ";
          if (popover.footer.querySelector("[data-onboarding-skip]") !== null) {
            return;
          }

          const skipButton = document.createElement("button");
          skipButton.className = "driver-popover-footer-btn";
          skipButton.dataset.onboardingSkip = "";
          skipButton.textContent = "スキップ";
          skipButton.type = "button";
          skipButton.addEventListener("click", () => {
            userResult = "skipped";
            instance.destroy();
          });
          popover.footer.insertBefore(skipButton, popover.footerButtons);
        },
        prevBtnText: "戻る",
        progressText: "{{current}} / {{total}}",
        showProgress: true,
        skipMissingElement: false,
        steps: gameBoardOnboardingSteps.map((step) => ({
          element: step.element,
          popover: {
            description: step.description,
            title: step.title,
          },
        })),
      });
      driverInstance = instance;
      window.requestAnimationFrame(() => {
        if (!disposed) {
          instance.drive();
        }
      });
    })().catch(() => {
      if (!disposed) {
        reportFinish("interrupted");
      }
    });

    return () => {
      disposed = true;
      if (driverInstance) {
        driverInstance.destroy();
      } else {
        reportFinish("interrupted");
      }
    };
  }, [prefersReducedMotion]);

  return <GameBoardOnboardingPreview />;
}
