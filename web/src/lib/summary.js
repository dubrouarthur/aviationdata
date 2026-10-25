// The closing summary of "Le ciel à deux vitesses": one card per chapter, handed over by each chapter
// with the numbers it has just computed, so the summary can never disagree with the story.
export const summary = new Map();

/** card: {value, label, color} */
export const addSummary = (id, card) => summary.set(id, card);
