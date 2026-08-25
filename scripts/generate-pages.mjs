import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, "public/pages");
const catalogOutputRoot = resolve(root, "public/catalog");
const localeNames = ["zh", "en", "ja"];
const dictionaries = Object.fromEntries(await Promise.all(localeNames.map(async (locale) => [
  locale,
  JSON.parse(await readFile(resolve(root, `src/i18n/${locale}.json`), "utf8")),
])));
const l = (key) => Object.fromEntries(localeNames.map((locale) => {
  const value = dictionaries[locale][key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${locale} translation: ${key}`);
  return [locale, value];
}));
const lt = (key, values) => Object.fromEntries(localeNames.map((locale) => [
  locale,
  Object.entries(values).reduce(
    (copy, [name, value]) => copy.replaceAll(`{${name}}`, value[locale] ?? value.zh),
    dictionaries[locale][key],
  ),
]));

const pages = [
  {
    path: "about",
    icon: "/assets/ninja-v1/items/gem-yellow.png",
    label: l("page.copy.town-square-first-lantern"),
    title: l("page.copy.about-young"),
    intro: l("page.copy.i-focus-on-ai-open-systems-and-on-chain-markets-i-like-compressi"),
    sections: [
      {
        title: l("page.copy.a-short-path"),
        body: l("page.copy.keeping-a-short-path-between-ideas-and-implementation-means-expo"),
      },
      {
        title: l("page.copy.why-this-town-exists"),
        body: l("page.copy.a-conventional-homepage-compresses-a-person-into-a-bio-and-links"),
      },
    ],
  },
  {
    path: "contact",
    icon: "/assets/ninja-v1/items/gem-green.png",
    label: l("page.copy.town-square-second-lantern"),
    title: l("page.copy.keep-in-touch"),
    intro: l("page.copy.if-you-are-also-exploring-complex-systems-ai-or-new-ways-of-coll"),
    links: [
      [l("page.link.githubProfile"), "https://github.com/YoungY620"],
      [l("page.link.twitterProfile"), "https://twitter.com/Bobby___Young"],
      [l("page.link.zhihuProfile"), "https://www.zhihu.com/people/bob-71-97"],
    ],
    sections: [{ title: l("page.copy.a-small-note"), body: l("page.copy.a-clear-topic-context-and-question-help-a-conversation-reach-the") }],
  },
  {
    path: "social",
    icon: "/assets/ninja-v1/items/gem-purple.png",
    label: l("page.copy.town-square-third-lantern"),
    title: l("page.copy.social-routes"),
    intro: l("page.copy.different-platforms-carry-different-kinds-of-notes-choose-a-rout"),
    links: [
      [l("page.link.githubCode"), "https://github.com/YoungY620"],
      [l("page.link.twitterNotes"), "https://twitter.com/Bobby___Young"],
      [l("page.link.zhihuAnswers"), "https://www.zhihu.com/people/bob-71-97"],
    ],
    sections: [],
  },
  {
    path: "library/resume",
    icon: "/assets/ninja-v1/items/book.png",
    label: l("page.copy.town-library-re-sume-shelf"),
    title: l("page.copy.re-sume"),
    intro: l("page.copy.young-e-software-engineering-background-engineer-and-builder"),
    sections: [
      { title: l("page.copy.education"), body: l("page.copy.tsinghua-university-software-engineering") },
      { title: l("page.copy.focus"), body: l("page.copy.artificial-intelligence-open-systems-on-chain-markets-and-method") },
      { title: l("page.copy.public-profiles"), body: l("page.copy.visit-github-for-public-code-and-projects-the-social-page-links") },
    ],
  },
  {
    path: "library/experience",
    icon: "/assets/ninja-v1/items/scroll.png",
    label: l("page.copy.town-library-experience-archive"),
    title: l("page.copy.experience"),
    intro: l("page.copy.this-public-version-records-the-durable-through-line-without-inv"),
    sections: [
      { title: l("page.copy.start-with-a-model"), body: l("page.copy.for-a-new-problem-identify-constraints-state-and-feedback-loops") },
      { title: l("page.copy.make-it-run"), body: l("page.copy.i-value-verifiable-work-runnable-prototypes-clear-interfaces-rep") },
    ],
  },
  {
    path: "library/articles",
    icon: "/assets/ninja-v1/items/book.png",
    label: l("page.copy.town-library-writing-desk"),
    title: l("page.copy.articles"),
    intro: l("page.copy.the-first-field-note-is-the-town-itself"),
    sections: [
      { title: l("page.copy.turning-a-homepage-into-a-place"), body: l("page.copy.information-architecture-does-not-have-to-be-a-navbar-the-dock-h") },
      { title: l("page.copy.static-can-still-have-state"), body: l("page.copy.github-pages-has-no-backend-but-the-browser-can-still-remember-p") },
    ],
  },
  {
    path: "library/learning",
    icon: "/assets/ninja-v1/items/scroll.png",
    label: l("page.copy.town-library-learning-notes"),
    title: l("page.copy.learning-notes"),
    intro: l("page.copy.these-pages-record-technical-facts-confirmed-while-building-this"),
    sections: [
      { title: l("page.copy.rpgjs-v5-standalone"), body: l("page.copy.the-main-world-runs-client-and-authoritative-game-logic-in-the-s") },
      { title: l("page.copy.static-paths"), body: l("page.copy.every-content-page-and-game-has-a-directly-addressable-directory") },
    ],
  },
  ...[
    ["travel", "world.copy.travel", "page.interest.travelIntro"],
    ["games", "world.copy.games", "page.interest.gamesIntro"],
    ["anime", "world.copy.anime", "page.interest.animeIntro"],
    ["music", "world.copy.music", "page.interest.musicIntro"],
    ["life", "world.copy.life", "page.interest.lifeIntro"],
  ].map(([slug, titleKey, introKey], index) => {
    const title = l(titleKey);
    return ({
    path: `interests/${slug}`,
    icon: index % 2 ? "/assets/ninja-v1/monsters/shell-blue.png" : "/assets/ninja-v1/monsters/shell-red.png",
    label: lt("page.interest.label", { title }),
    title,
    intro: l(introKey),
    sections: [{ title: l("page.copy.shore-note"), body: l("page.copy.this-shell-will-grow-with-real-notes-for-now-it-states-its-place") }],
  });}),
  {
    path: "credits",
    icon: "/assets/ninja-v1/items/scroll.png",
    label: l("page.copy.town-hall-builder-ledger"),
    title: l("page.copy.credits"),
    intro: l("page.copy.wayfarer-lantern-town-uses-a-single-shared-pack-for-pixel-art-ui"),
    sections: [
      { title: l("page.copy.ninja-adventure-asset-pack"), body: l("page.copy.created-by-pixel-boy-and-aaa-licensed-under-cc0-1-0-universal-as") },
      { title: l("page.copy.jacquard"), body: l("page.copy.created-by-keijiro") },
      { id: "owner-audio", title: l("page.credits.ownerAudioTitle"), body: l("page.credits.ownerAudioBody") },
    ],
    links: [
      [l("page.link.ninjaPack"), "https://pixel-boy.itch.io/ninja-adventure-asset-pack"],
      [l("page.link.pixelBoyTwitter"), "https://twitter.com/2Pblog1"],
      [l("page.link.keijiroTwitter"), "https://twitter.com/_kzr"],
      [l("page.link.jacquardGithub"), "https://github.com/keijiro/Jacquard"],
      [l("page.link.cc0"), "https://creativecommons.org/publicdomain/zero/1.0/"],
    ],
  },
];

const uiKeys = {
  back: "page.ui.back",
  route: "page.ui.route",
  open: "page.ui.open",
  credits: "page.ui.credits",
  skip: "page.ui.skip",
  town: "page.ui.town",
  creditsLink: "page.ui.creditsLink",
};
const text = Object.fromEntries(localeNames.map((locale) => [
  locale,
  Object.fromEntries(Object.entries(uiKeys).map(([name, key]) => [name, dictionaries[locale][key]])),
]));

function localized(value, locale = "zh") {
  return value?.[locale] ?? value?.zh ?? "";
}

function pageHtml(page) {
  const contentJson = JSON.stringify({ page, text }).replaceAll("<", "\\u003c");
  const sections = page.sections.map((section) => `<section class="log-section"${section.id ? ` id="${section.id}"` : ""}><h2>${localized(section.title)}</h2><p>${localized(section.body)}</p></section>`).join("");
  const links = (page.links ?? []).map(([label, url]) => `<a class="route-link" href="${url}" target="_blank" rel="noreferrer"><span>${localized(label)}</span><span aria-hidden="true">↗</span></a>`).join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#172638" />
  <meta name="description" content="${localized(page.intro).replaceAll('"', "&quot;")}" />
  <link rel="stylesheet" href="/assets/site.css" />
  <title>${localized(page.title)} · ${text.zh.town}</title>
</head>
<body>
  <a class="skip-link" href="#content" data-ui="skip">${text.zh.skip}</a>
  <div class="page-sky" aria-hidden="true"></div>
  <header class="page-header">
    <a class="town-link" href="/">← <span data-ui="back">${text.zh.back}</span></a>
    <nav class="locale-switch" aria-label="Language">
      <button type="button" data-locale="zh" aria-pressed="true">中</button>
      <button type="button" data-locale="ja" aria-pressed="false">日</button>
      <button type="button" data-locale="en" aria-pressed="false">EN</button>
    </nav>
  </header>
  <main id="content" class="page-layout">
    <aside class="route-rail" aria-hidden="true">
      <span class="route-rail__seal"><img src="${page.icon}" alt="" /></span>
      <i></i><span>◆</span><i></i><span>≈</span>
    </aside>
    <article class="journal-panel">
      <p class="journal-kicker" data-page="label">${localized(page.label)}</p>
      <img class="journal-icon" src="${page.icon}" alt="" />
      <h1 data-page="title">${localized(page.title)}</h1>
      <p class="journal-intro" data-page="intro">${localized(page.intro)}</p>
      <div data-page="sections">${sections}</div>
      <div class="route-links" data-page="links">${links}</div>
    </article>
  </main>
  <footer class="page-footer">
    <p data-ui="credits">${text.zh.credits}</p>
    <a href="https://pixel-boy.itch.io/ninja-adventure-asset-pack" target="_blank" rel="noreferrer"><span data-ui="creditsLink">${text.zh.creditsLink}</span> ↗</a>
  </footer>
  <script id="page-content" type="application/json">${contentJson}</script>
  <script type="module" src="/assets/site-page.js"></script>
</body>
</html>`;
}

for (const page of pages) {
  const destination = resolve(outputRoot, page.path);
  await mkdir(destination, { recursive: true });
  await writeFile(resolve(destination, "index.html"), pageHtml(page), "utf8");
}

await mkdir(catalogOutputRoot, { recursive: true });
await copyFile(resolve(root, "catalog/games.json"), resolve(catalogOutputRoot, "games.json"));

console.log(`Generated ${pages.length} multilingual content pages.`);
