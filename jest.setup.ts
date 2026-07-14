import "@testing-library/jest-dom";

const performanceWithResourceTiming = performance as Performance & {
  markResourceTiming?: () => void;
};

if (typeof performanceWithResourceTiming.markResourceTiming !== "function") {
  Object.assign(performanceWithResourceTiming, {
    markResourceTiming: () => undefined,
  });
}
