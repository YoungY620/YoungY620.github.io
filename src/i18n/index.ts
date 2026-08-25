import zh from "./zh.json";
import ja from "./ja.json";
import en from "./en.json";

export const locales = { zh, ja, en } as const;
export type Locale = keyof typeof locales;
export type MessageKey = keyof typeof zh;
export type LocalizedText = Record<Locale, string>;

export function message(locale: Locale, key: MessageKey): string {
  return locales[locale][key] ?? locales.zh[key] ?? key;
}

export function localized(key: MessageKey): LocalizedText {
  return {
    zh: locales.zh[key],
    ja: locales.ja[key],
    en: locales.en[key],
  };
}

export function localizedTemplate(key: MessageKey, values: Record<string, LocalizedText>): LocalizedText {
  const render = (locale: Locale) => Object.entries(values).reduce(
    (copy, [name, value]) => copy.replaceAll(`{${name}}`, value[locale] ?? value.zh),
    locales[locale][key] ?? locales.zh[key] ?? key,
  );
  return { zh: render("zh"), ja: render("ja"), en: render("en") };
}

export function readLocale(): Locale {
  try {
    const value = globalThis.localStorage?.getItem("wayfarer-locale-v1");
    if (value === "ja" || value === "en") return value;
  } catch {
    // RPGJS standalone can initialize before browser storage is available.
  }
  return "zh";
}
