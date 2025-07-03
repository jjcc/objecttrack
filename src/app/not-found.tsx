"use client"

import { Suspense } from "react"
import { Authenticated } from "@refinedev/core"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function NotFound() {
  return (
    <Suspense>
      <Authenticated key="not-found">
        <div className="container mx-auto py-10">
          <Card>
            <CardHeader>
              <CardTitle>404 - Page Not Found</CardTitle>
              <CardDescription>
                The page you are looking for does not exist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.href = "/"}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </Authenticated>
    </Suspense>
  )
}
