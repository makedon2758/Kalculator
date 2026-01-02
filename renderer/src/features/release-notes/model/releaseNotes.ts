export type ReleaseNotes = {
  title: string;
  items: string[];
};

export const RELEASE_NOTES: Record<string, ReleaseNotes> = {
  "0.1.0": {
    title: "Обновление 0.1.0",
    items: [
      "Добавлен каркас приложения (вкладки, базовый UI).",
      "Подготовлена архитектура для переноса модулей 1:1.",
      "Подготовка к офлайн-режиму (без CDN).",
    ],
  },
};
