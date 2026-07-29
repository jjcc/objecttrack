"use client";

import {
  Alert,
  Center,
  Container,
  Image,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

type ObjectInfo = {
  id: number;
  name: string;
  description: string | null;
  category_name: string | null;
  model: string | null;
  image: string | null;
  extra: Json | null;
  institution_name: string;
  owner_name: string | null;
  created_at: string;
};

function InfoField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text>{value === null || value === "" ? "—" : value}</Text>
    </div>
  );
}

export default function PublicObjectInfoPage() {
  const params = useParams();
  const id = Number(params.id);
  const [record, setRecord] = useState<ObjectInfo | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchObjectInfo() {
      if (!Number.isSafeInteger(id) || id < 1) {
        setError("This object link is invalid.");
        setIsLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error: loadError } = await supabase
        .rpc("object_info", { p_object_id: id });
      const objectInfo = data?.[0] as ObjectInfo | undefined;

      if (loadError) {
        setError(loadError.message);
      } else if (!objectInfo) {
        setError("This object does not exist or its information is private.");
      } else {
        setRecord(objectInfo);
        if (objectInfo.image) {
          const { data: signedImage } = await supabase.storage
            .from("object-images")
            .createSignedUrl(objectInfo.image, 60 * 60);
          setImageUrl(signedImage?.signedUrl ?? null);
        }
      }
      setIsLoading(false);
    }
    fetchObjectInfo();
  }, [id]);

  if (isLoading) {
    return <Center mih="100vh"><Loader /></Center>;
  }

  if (error || !record) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" title="Object information unavailable" icon={<IconAlertCircle size={18} />}>
          {error}
        </Alert>
      </Container>
    );
  }

  const extra =
    record.extra && !Array.isArray(record.extra) && typeof record.extra === "object"
      ? record.extra
      : {};

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>{record.name}</Title>
          <Text c="dimmed">{record.institution_name}</Text>
        </div>
        <Paper withBorder p="lg" radius="md">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={`${record.name} image`}
              maw={420}
              mah={300}
              fit="contain"
              mb="xl"
            />
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <InfoField label="Object ID" value={record.id} />
            <InfoField label="Institution" value={record.institution_name} />
            <InfoField label="Owner" value={record.owner_name} />
            <InfoField label="Category" value={record.category_name} />
            <InfoField label="Model" value={record.model} />
            <InfoField
              label="Created"
              value={dayjs(record.created_at).format("YYYY-MM-DD HH:mm")}
            />
            <InfoField label="Description" value={record.description} />
            {Object.entries(extra).map(([name, value]) => (
              <InfoField
                key={name}
                label={name}
                value={
                  value === null || typeof value === "string" || typeof value === "number"
                    ? value
                    : JSON.stringify(value)
                }
              />
            ))}
          </SimpleGrid>
        </Paper>
      </Stack>
    </Container>
  );
}
