import { defineModule } from "@rpgjs/common";
import { type MapEventPlacement, RpgServer } from "@rpgjs/server";
import { localized as l, localizedTemplate as lt, type LocalizedText } from "../../i18n";
import { ImmortalNpc, LinkEvent, MapDoor, MusicEvent, WorldReturn } from "./events";
import { player } from "./player";

const internal = (label: LocalizedText, url: string) => ({ label, url });
const external = (label: LocalizedText, url: string) => ({ label, url, external: true });

const worldEvents: MapEventPlacement[] = [
  {
    id: "about-marker",
    x: 23 * 32,
    y: 16 * 32,
    event: LinkEvent({
      name: "about",
      graphic: "gem-yellow",
      kicker: l("world.copy.town-square-first-lantern"),
      title: l("world.copy.about-young"),
      copy: l("world.copy.engineer-and-builder-focused-on-ai-open-systems-and-on-chain-mar"),
      actions: [internal(l("world.copy.open-profile"), "/pages/about/")],
    }),
  },
  {
    id: "contact-marker",
    x: 25 * 32,
    y: 16 * 32,
    event: LinkEvent({
      name: "contact",
      graphic: "gem-green",
      kicker: l("world.copy.town-square-second-lantern"),
      title: l("world.copy.contact"),
      copy: l("world.copy.if-you-also-study-complex-systems-this-is-a-good-place-to-start"),
      actions: [internal(l("world.copy.view-contact-routes"), "/pages/contact/")],
    }),
  },
  {
    id: "social-marker",
    x: 27 * 32,
    y: 16 * 32,
    event: LinkEvent({
      name: "social",
      graphic: "gem-purple",
      kicker: l("world.copy.town-square-third-lantern"),
      title: l("world.copy.social-routes"),
      copy: l("world.copy.github-twitter-and-zhihu-meet-at-this-purple-marker"),
      actions: [internal(l("world.copy.view-social-routes"), "/pages/social/")],
    }),
  },
  { id: "town-radio", x: 25 * 32, y: 18 * 32, event: MusicEvent() },
  {
    id: "dock-captain",
    x: 29 * 32,
    y: 50 * 32,
    event: ImmortalNpc({
      id: "captain",
      graphic: "old-man",
      title: l("world.copy.old-captain"),
      lines: [
        l("world.copy.ships-leave-the-dock-and-links-do-too-at-least-the-links-open-in"),
        l("world.copy.walk-north-every-road-eventually-meets-at-the-square"),
      ],
      hitLines: [
        l("world.copy.a-deck-can-be-repaired-these-old-bones-have-no-undo-key"),
        l("world.copy.check-where-the-focus-is-before-swinging-youngster"),
      ],
    }),
  },
  {
    id: "dock-links",
    x: 33 * 32,
    y: 53 * 32,
    event: LinkEvent({
      name: "dock-links",
      graphic: "scroll",
      kicker: l("world.copy.traveler-dock-outbound-routes"),
      title: l("world.copy.where-to-today"),
      copy: l("world.copy.choose-a-route-its-destination-opens-in-a-new-tab"),
      actions: [
        external(l("world.copy.github"), "https://github.com/YoungY620"),
        external(l("world.copy.twitter-x"), "https://twitter.com/Bobby___Young"),
        external(l("world.copy.zhihu"), "https://www.zhihu.com/people/bob-71-97"),
      ],
    }),
  },
  { id: "library-door", x: 35 * 32, y: 6 * 32, event: MapDoor("library", "book", "library", 10 * 32, 12 * 32) },
  { id: "hall-door", x: 31 * 32, y: 6 * 32, event: MapDoor("hall", "scroll", "town-hall", 10 * 32, 12 * 32) },
  { id: "cottage-door", x: 24 * 32, y: 6 * 32, event: MapDoor("cottage", "gold-key", "cottage", 10 * 32, 12 * 32) },
  {
    id: "forest-npc",
    x: 24 * 32,
    y: 9 * 32,
    event: ImmortalNpc({
      id: "camper",
      graphic: "villager-2",
      title: l("world.copy.camper"),
      lines: [
        l("world.copy.how-deep-is-the-cave-about-as-long-as-it-takes-coffee-to-go-cold"),
        l("world.copy.the-boss-is-not-the-hard-part-remembering-to-check-every-lantern"),
      ],
      hitLines: [l("world.copy.this-is-not-a-hit-test-tutorial"), l("world.copy.i-have-no-health-bar-but-i-do-have-opinions")],
    }),
  },
  {
    id: "reference-pig",
    x: 30 * 32,
    y: 18 * 32,
    event: ImmortalNpc({
      id: "reference-pig",
      graphic: "pig",
      title: l("world.copy.village-pig"),
      lines: [
        l("world.copy.it-clearly-understood-and-chose-to-answer-with-one-snort"),
      ],
      hitLines: [l("world.copy.the-pig-does-not-drop-bacon")],
    }),
  },
  {
    id: "reference-samurai-green",
    x: 29 * 32,
    y: 15 * 32,
    event: ImmortalNpc({
      id: "reference-samurai-green",
      graphic: "samurai-green",
      title: l("world.copy.green-samurai"),
      lines: [l("world.copy.the-trees-and-roads-remain-where-the-old-village-placed-them")],
      hitLines: [l("world.copy.the-stance-holds-but-i-do-not-die")],
    }),
  },
  {
    id: "reference-samurai-blue",
    x: 24 * 32,
    y: 8 * 32,
    event: ImmortalNpc({
      id: "reference-samurai-blue",
      graphic: "samurai-blue",
      title: l("world.copy.road-samurai"),
      lines: [l("world.copy.houses-lie-north-the-old-southern-road-reaches-the-traveler-dock")],
      hitLines: [l("world.copy.this-is-a-patrol-not-a-duel")],
    }),
  },
  {
    id: "cave-entry",
    x: 32 * 32,
    y: 7 * 32,
    event: LinkEvent({
      name: "dungeon-one",
      graphic: "gold-key",
      kicker: l("world.copy.north-hill-end-the-only-local-game"),
      title: l("world.copy.adventure-cave-lantern-trial"),
      copy: l("world.copy.an-independent-save-six-to-eight-rooms-mechanisms-elite-enemies"),
      actions: [
        internal(l("world.copy.enter-in-a-new-tab"), "/games/dungeon-one/"),
        external(l("world.copy.github-game-experiments"), "https://github.com/YoungY620"),
      ],
    }),
  },
  ...[
    ["travel", l("world.copy.travel"), "/pages/interests/travel/", 42, 10],
    ["games", l("world.copy.games"), "/pages/interests/games/", 44, 12],
    ["anime", l("world.copy.anime"), "/pages/interests/anime/", 46, 14],
    ["music", l("world.copy.music"), "/pages/interests/music/", 42, 16],
    ["life", l("world.copy.life"), "/pages/interests/life/", 45, 18],
  ].map(([id, title, url, x, y], index) => {
    const localizedTitle = title as LocalizedText;
    return ({
    id: `shell-${id}`,
    x: Number(x) * 32,
    y: Number(y) * 32,
    event: LinkEvent({
      name: `interest-${id}`,
      graphic: index % 2 ? "shell-blue" : "shell-red",
      kicker: lt("world.template.interestKicker", { title: localizedTitle }),
      title: localizedTitle,
      copy: l("world.copy.pick-up-this-tagged-shell-to-unfold-a-note-from-the-shore"),
      actions: [internal(lt("world.template.openInterest", { title: localizedTitle }), String(url))],
    }),
  });}),
];

const libraryEvents: MapEventPlacement[] = [
  { id: "library-exit", x: 10 * 32, y: 13 * 32, event: WorldReturn("library-exit", 35 * 32, 7 * 32) },
  ...[
    ["resume", l("world.copy.re-sume"), "/pages/library/resume/", 3],
    ["experience", l("world.copy.experience"), "/pages/library/experience/", 7],
    ["articles", l("world.copy.articles"), "/pages/library/articles/", 11],
    ["learning", l("world.copy.learning-notes"), "/pages/library/learning/", 15],
  ].map(([id, title, url, x]) => {
    const localizedTitle = title as LocalizedText;
    return ({
    id: `library-${id}`,
    x: Number(x) * 32,
    y: 4 * 32,
    event: LinkEvent({
      name: `library-${id}`,
      graphic: "book",
      kicker: l("world.copy.town-library-open-shelf"),
      title: localizedTitle,
      copy: l("world.copy.this-book-unfolds-in-a-new-tab-while-the-game-stays-here"),
      actions: [internal(lt("world.template.openLibrary", { title: localizedTitle }), String(url))],
    }),
  });}),
];

const hallEvents: MapEventPlacement[] = [
  { id: "hall-exit", x: 10 * 32, y: 13 * 32, event: WorldReturn("hall-exit", 31 * 32, 7 * 32) },
  {
    id: "hall-credits",
    x: 10 * 32,
    y: 5 * 32,
    event: LinkEvent({
      name: "credits",
      graphic: "scroll",
      kicker: l("world.copy.town-hall-builder-ledger"),
      title: l("world.copy.credits"),
      copy: l("world.copy.all-pixel-art-ui-sound-effects-and-music-in-town-come-from-the-n"),
      actions: [internal(l("world.copy.view-full-credits"), "/pages/credits/")],
    }),
  },
  {
    id: "hall-clerk",
    x: 7 * 32,
    y: 8 * 32,
    event: ImmortalNpc({
      id: "clerk",
      graphic: "inspector",
      title: l("world.copy.town-clerk"),
      lines: [l("world.copy.this-town-has-no-backend-all-records-are-static-files-public-ord"), l("world.copy.if-a-route-fails-check-its-letter-case-on-github-pages")],
      hitLines: [l("world.copy.hitting-a-civil-servant-unlocks-no-secret-achievement"), l("world.copy.recorded-interaction-testing-was-overly-enthusiastic")],
    }),
  },
];

const cottageEvents: MapEventPlacement[] = [
  { id: "cottage-exit", x: 10 * 32, y: 13 * 32, event: WorldReturn("cottage-exit", 24 * 32, 7 * 32) },
  {
    id: "cottage-host",
    x: 10 * 32,
    y: 6 * 32,
    event: ImmortalNpc({
      id: "host",
      graphic: "old-woman",
      title: l("world.copy.innkeeper"),
      lines: [l("world.copy.the-rooms-are-still-being-arranged-sit-a-while-even-a-static-sit"), l("world.copy.there-are-no-daily-quests-here-come-and-go-whenever-you-like")],
      hitLines: [l("world.copy.you-can-test-immortality-without-using-me-as-a-unit-test"), l("world.copy.relax-i-will-not-drop-the-inn-key")],
    }),
  },
];

export default defineModule<RpgServer>({
  player,
  maps: [
    { id: "world", events: worldEvents },
    { id: "library", events: libraryEvents },
    { id: "town-hall", events: hallEvents },
    { id: "cottage", events: cottageEvents },
  ],
});
