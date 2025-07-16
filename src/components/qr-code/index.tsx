"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";

interface QrCodeProps {
  value: string;
  size: number;
}

const QrCode: React.FC<QrCodeProps> = ({ value, size }) => {
  return <QRCodeSVG value={value} size={size} />;
};

export default QrCode;
