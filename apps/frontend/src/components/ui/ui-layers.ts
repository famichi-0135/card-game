export const UI_LAYER = {
  board: 0,
  boardRaised: 20,
  boardDrag: 40,
  popover: 700,
  modal: 900,
  toast: 1000,
} as const;

export const UI_LAYER_CLASS = {
  board: "z-0",
  boardRaised: "z-20",
  boardDrag: "z-40",
  popover: "z-[700]",
  modal: "z-[900]",
  toast: "z-[1000]",
} as const;
