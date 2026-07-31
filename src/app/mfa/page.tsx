"use client";

import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  PinInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export default function MfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const nextPath =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/ops";
  const [loading, setLoading] = useState(true);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getSupabaseClient();
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (factorsError) {
        setError(factorsError.message);
      } else {
        setVerifiedFactorId(data.totp.find((factor) => factor.status === "verified")?.id ?? null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function enroll() {
    setError(null);
    const supabase = getSupabaseClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "ObjectTrack platform operations",
    });
    if (enrollError) {
      setError(enrollError.message);
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verify() {
    const factorId = enrollment?.factorId ?? verifiedFactorId;
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Center mih="100vh" bg="gray.1" px="md">
      <Paper withBorder shadow="md" p="xl" radius="md" w={440}>
        <Stack align="center">
          <Title order={2}>Secure platform access</Title>
          <Text c="dimmed" size="sm" ta="center">
            Platform operations require a verified authenticator code for this
            session.
          </Text>
          {loading ? (
            <Loader />
          ) : (
            <>
              {error && <Alert color="red">{error}</Alert>}
              {!verifiedFactorId && !enrollment && (
                <Button onClick={enroll}>Set up authenticator</Button>
              )}
              {enrollment && (
                <Stack align="center">
                  <Image
                    src={enrollment.qrCode}
                    alt="Authenticator setup QR code"
                    width={220}
                    height={220}
                    unoptimized
                  />
                  <Text size="xs" c="dimmed" ta="center">
                    If you cannot scan the code, enter this secret:
                    <br />
                    <Text component="span" ff="monospace">
                      {enrollment.secret}
                    </Text>
                  </Text>
                </Stack>
              )}
              {(verifiedFactorId || enrollment) && (
                <>
                  <PinInput
                    length={6}
                    inputType="number"
                    inputMode="numeric"
                    oneTimeCode
                    value={code}
                    onChange={setCode}
                  />
                  <Button
                    fullWidth
                    loading={verifying}
                    disabled={code.length !== 6}
                    onClick={verify}
                  >
                    Verify and continue
                  </Button>
                </>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
