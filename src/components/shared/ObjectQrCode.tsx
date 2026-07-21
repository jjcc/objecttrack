"use client";

import { Stack, Text, Paper, Group, Button, CopyButton, Anchor } from "@mantine/core";
import { QRCodeSVG } from "qrcode.react";
import { IconLink, IconCopy, IconCheck } from "@tabler/icons-react";

interface ObjectQrCodeProps {
  objectId: number;
  size?: number;
}

function getBarcodeValue(objectId: number) {
  return objectId.toString().padStart(16, "0");
}

export function ObjectQrCode({ objectId, size = 256 }: ObjectQrCodeProps) {
  const barcodeValue = getBarcodeValue(objectId);
  const apiUrl = `/api/qr/${objectId}`;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack align="center" gap="sm">
        <QRCodeSVG value={barcodeValue} size={size} />
        <Text size="sm" fw={600}>
          Object ID: {objectId}
        </Text>
        <Text size="xs" c="dimmed">
          Encoded value: {barcodeValue}
        </Text>
        <Group gap="xs" mt="xs">
          <Anchor href={apiUrl} target="_blank" size="sm">
            <Group gap={4}>
              <IconLink size={14} />
              <span>Share / Print</span>
            </Group>
          </Anchor>
          <CopyButton value={apiUrl}>
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
