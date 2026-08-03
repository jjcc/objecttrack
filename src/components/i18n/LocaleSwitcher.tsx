"use client";

import {Select} from "@mantine/core";
import {useLocale, useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {useTransition} from "react";
import {setLocale} from "@/i18n/actions";
import {isAppLocale} from "@/i18n/config";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      aria-label={t("label")}
      data={[
        {label: "English", value: "en"},
        {label: "简体中文", value: "zh-CN"}
      ]}
      disabled={isPending}
      value={locale}
      onChange={(value) => {
        if (!isAppLocale(value) || value === locale) return;
        startTransition(async () => {
          await setLocale(value);
          router.refresh();
        });
      }}
      size="xs"
      w={112}
      allowDeselect={false}
    />
  );
}
