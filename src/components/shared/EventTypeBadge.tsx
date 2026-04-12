"use client";

import { Badge } from "@mantine/core";

interface EventTypeBadgeProps {
  label: string;
}

const colorMap: Record<string, string> = {
  transfer: "blue",
  inspection: "green",
  handover: "orange",
  maintenance: "violet",
  return: "teal",
};

export function EventTypeBadge({ label }: EventTypeBadgeProps) {
  const color = colorMap[label.toLowerCase()] ?? "gray";

  return (
    <Badge color={color} variant="light" size="sm">
      {label}
    </Badge>
  );
}
