"use client";

import { Stack, Text, Paper, Group, Button, CopyButton, Anchor } from "@mantine/core";
import { QRCodeSVG } from "qrcode.react";
import { IconLink, IconCopy, IconCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";

interface ObjectQrCodeProps {
  objectId: number;
  size?: number;
}

export function ObjectQrCode({ objectId, size = 256 }: ObjectQrCodeProps) {
  const objectInfoPath = `/object-info/${objectId}`;
  const [origin, setOrigin] = useState(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://objecttrack.vercel.app"
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const objectInfoUrl = `${origin}${objectInfoPath}`;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack align="center" gap="sm">
        <QRCodeSVG value={objectInfoUrl} size={size} />
        <Text size="sm" fw={600}>
          Object ID: {objectId}
        </Text>
        <Text size="xs" c="dimmed">
          Opens the object information page
        </Text>
        <Group gap="xs" mt="xs">
          <Anchor href={objectInfoPath} target="_blank" size="sm">
            <Group gap={4}>
              <IconLink size={14} />
              <span>Open Object Info</span>
            </Group>
          </Anchor>
          <CopyButton value={objectInfoUrl}>
            {({ copied, copy }) => (
              <Button
                size="compact-sm"
                variant="light"
                color={copied ? "teal" : "gray"}
                onClick={copy}
                leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            )}
          </CopyButton>
        </Group>
      </Stack>
    </Paper>
  );
}
