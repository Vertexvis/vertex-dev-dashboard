import { Theme } from "@material-ui/core/styles";

interface Transition {
  easing: string;
  duration: number;
}

export function sharpLeaving(theme: Theme): Transition {
  return {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  };
}

export function easeOutEntering(theme: Theme): Transition {
  return {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.enteringScreen,
  };
}
