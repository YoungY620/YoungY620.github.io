import { readLocale, type Locale, type LocalizedText } from "../../i18n";

export type WorldLocale = Locale;
export type { LocalizedText };

export type WorldDialogAction = {
  label: LocalizedText;
  url: string;
  external?: boolean;
};

export type WorldDialog = {
  kicker: LocalizedText;
  title: LocalizedText;
  copy: LocalizedText;
  actions?: WorldDialogAction[];
};

export function currentWorldLocale(): WorldLocale {
  return readLocale();
}

export function resolveText(value: LocalizedText): string {
  return value[currentWorldLocale()] ?? value.zh;
}

export function emitWorldEvent(name: string, detail?: unknown) {
  if (typeof globalThis.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return;
  globalThis.dispatchEvent(new CustomEvent(`wayfarer:${name}`, { detail }));
}
