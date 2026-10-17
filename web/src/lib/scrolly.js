/** Run fn while node is on screen (animation loops), pause otherwise. */
export function whileVisible(node, onShow, onHide) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? onShow : onHide)();
  });
  io.observe(node);
}

export const PLAY_ICON =
  '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>';
export const PAUSE_ICON =
  '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';

/** Play/pause button driving a range input through its values. */
export function player({
  button,
  slider,
  output,
  values,
  format = String,
  onChange,
  interval = 420,
  labels = {},
}) {
  let timer = null;
  let index = values.length - 1;
  Object.assign(slider, { min: 0, max: values.length - 1, step: 1, value: index });
  const show = () => {
    output.textContent = format(values[index]);
    slider.value = index;
  };
  const set = (i, fire = true) => {
    index = Math.max(0, Math.min(values.length - 1, i));
    show();
    if (fire) onChange(values[index], index);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    button.innerHTML = PLAY_ICON;
    button.setAttribute("aria-label", labels.play || "Lancer l'animation");
  };
  const start = () => {
    if (index >= values.length - 1) set(0);
    button.innerHTML = PAUSE_ICON;
    button.setAttribute("aria-label", labels.pause || "Mettre en pause");
    timer = setInterval(() => (index >= values.length - 1 ? stop() : set(index + 1)), interval);
  };
  button.innerHTML = PLAY_ICON;
  button.addEventListener("click", () => (timer ? stop() : start()));
  slider.addEventListener("input", () => {
    stop();
    set(+slider.value);
  });
  show();
  return {
    set: (v, fire = true) => set(values.indexOf(v) >= 0 ? values.indexOf(v) : index, fire),
    stop,
    playing: () => !!timer,
  };
}
