const LOCALE_KEY = "wayfarer-locale-v1";
const content = JSON.parse(document.querySelector("#page-content").textContent);
const supported = new Set(["zh", "ja", "en"]);

function localeFromStorage() {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved && supported.has(saved)) return saved;
  if (navigator.language.toLowerCase().startsWith("ja")) return "ja";
  if (navigator.language.toLowerCase().startsWith("en")) return "en";
  return "zh";
}

function value(item, locale) {
  return item?.[locale] ?? item?.zh ?? "";
}

function render(locale) {
  localStorage.setItem(LOCALE_KEY, locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  document.title = `${value(content.page.title, locale)} · ${content.text[locale].town}`;
  document.querySelector('[data-page="label"]').textContent = value(content.page.label, locale);
  document.querySelector('[data-page="title"]').textContent = value(content.page.title, locale);
  document.querySelector('[data-page="intro"]').textContent = value(content.page.intro, locale);
  document.querySelector('[data-ui="back"]').textContent = content.text[locale].back;
  document.querySelector('[data-ui="credits"]').textContent = content.text[locale].credits;
  document.querySelector('[data-ui="skip"]').textContent = content.text[locale].skip;
  document.querySelector('[data-ui="creditsLink"]').textContent = content.text[locale].creditsLink;

  const sections = document.querySelector('[data-page="sections"]');
  sections.replaceChildren();
  for (const section of content.page.sections) {
    const node = document.createElement("section");
    node.className = "log-section";
    if (section.id) node.id = section.id;
    const heading = document.createElement("h2");
    heading.textContent = value(section.title, locale);
    const paragraph = document.createElement("p");
    paragraph.textContent = value(section.body, locale);
    node.append(heading, paragraph);
    sections.append(node);
  }

  const links = document.querySelector('[data-page="links"]');
  links.replaceChildren();
  for (const [label, url] of content.page.links ?? []) {
    const anchor = document.createElement("a");
    anchor.className = "route-link";
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    const name = document.createElement("span");
    name.textContent = value(label, locale);
    const arrow = document.createElement("span");
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");
    anchor.append(name, arrow);
    links.append(anchor);
  }

  document.querySelectorAll("[data-locale]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.locale === locale));
  });
}

document.querySelectorAll("[data-locale]").forEach((button) => {
  button.addEventListener("click", () => render(button.dataset.locale));
});

render(localeFromStorage());
