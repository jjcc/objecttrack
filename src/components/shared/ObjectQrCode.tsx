"use client";

import { Stack, Text, Paper } from "@mantine/core";
import { QRCodeSVG } from "qrcode.react";

interface ObjectQrCodeProps {
  objectId: number;
  size?: number;
}

function getBarcodeValue(objectId: number) {
  return objectId.toString().padStart(16, "0");
}

export function ObjectQrCode({ objectId, size = 256 }: ObjectQrCodeProps) {
  const barcodeValue = getBarcodeValue(objectId);

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
      </Stack>
    </Paper>
  );
}
