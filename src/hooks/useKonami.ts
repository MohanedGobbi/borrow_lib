import { useEffect, useState } from "react";

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

/**
 * Hidden staff access: returns true once the Konami code
 * (↑↑↓↓←→←→ B A) has been entered. Persisted in sessionStorage.
 */
export function useKonami(): boolean {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("lb_staff_unlocked") === "1"
  );

  useEffect(() => {
    if (unlocked) return;
    let progress: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      progress = [...progress, e.key].slice(-KONAMI.length);
      if (progress.join(",") === KONAMI.join(",")) {
        sessionStorage.setItem("lb_staff_unlocked", "1");
        setUnlocked(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlocked]);

  return unlocked;
}
