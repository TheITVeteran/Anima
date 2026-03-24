import { createI18n } from "vue-i18n";
import en from "./en";
import zhCn from "./zh_cn";

type LocaleType = "zhCn" | "en";

const getLanguage = (): LocaleType => {
  const saved = localStorage.getItem("animaLanguage");
  if (saved === "en" || saved === "zhCn") return saved;
  const browser = (navigator.language || "").toLowerCase();
  return browser.startsWith("zh") ? "zhCn" : "en";
};

const i18n = createI18n({
  locale: getLanguage(),
  fallbackLocale: "en",
  legacy: false,
  globalInjection: true,
  allowComposition: true,
  messages: {
    zhCn,
    en,
  },
});

const setLanguage = (locale: LocaleType) => {
  i18n.global.locale.value = locale;
  localStorage.setItem("animaLanguage", locale);
};

const translate = (key: string, params?: Record<string, unknown>) =>
  params ? i18n.global.t(key, params) : i18n.global.t(key);

export default i18n;
export { setLanguage, translate };
