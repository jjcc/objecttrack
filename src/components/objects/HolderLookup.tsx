"use client";

import {
  Alert,
  Button,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { getSupabaseClient } from "@/lib/supabase/client";

type HolderLookupResult = {
  object_id: number;
  object_name: string;
  category_name: string | null;
  model: string | null;
  current_holder_name: string | null;
};

export function HolderLookup() {
  const t = useTranslations("Scan");
  const [objectId, setObjectId] = useState("");
  const [result, setResult] = useState<HolderLookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function lookup() {
    const id = Number(objectId);
    if (!Number.isSafeInteger(id) || id < 1) {
      setResult(null);
      setNotFound(true);
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    const { data, error } = await getSupabaseClient().rpc(
      "lookup_object_holder",
      { p_object_id: id }
    );
    const record = data?.[0] ?? null;
    setResult(error ? null : record);
    setNotFound(Boolean(error) || !record);
    setIsLoading(false);
  }

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack>
        <Text fw={600}>{t("lookupTitle")}</Text>
        <Text size="sm" c="dimmed">{t("lookupDescription")}</Text>
        <TextInput
          label={t("objectId")}
          value={objectId}
          onChange={(event) => setObjectId(event.currentTarget.value)}
          inputMode="numeric"
        />
        <Button onClick={lookup} loading={isLoading}>
          {t("lookup")}
        </Button>
        {notFound ? <Alert color="yellow">{t("notFound")}</Alert> : null}
        {result ? (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div><Text size="xs" c="dimmed">{t("object")}</Text><Text>{result.object_name}</Text></div>
            <div><Text size="xs" c="dimmed">{t("currentHolder")}</Text><Text>{result.current_holder_name ?? t("unassigned")}</Text></div>
            <div><Text size="xs" c="dimmed">{t("category")}</Text><Text>{result.category_name ?? "—"}</Text></div>
            <div><Text size="xs" c="dimmed">{t("model")}</Text><Text>{result.model ?? "—"}</Text></div>
          </SimpleGrid>
        ) : null}
      </Stack>
    </Paper>
  );
}
