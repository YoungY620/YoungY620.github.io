const year = document.querySelector("#year");
const monogram = document.querySelector(".monogram");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (monogram && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.addEventListener(
    "pointermove",
    (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 12;
      const y = (event.clientY / window.innerHeight - 0.5) * 12;

      monogram.style.setProperty("--mark-x", `${x}px`);
      monogram.style.setProperty("--mark-y", `${y}px`);
    },
    { passive: true },
  );
}
