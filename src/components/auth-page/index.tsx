"use client"

import * as React from "react"
import { useLogin, useRegister } from "@refinedev/core"
import type { AuthPageProps } from "@refinedev/core"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const AuthPage = ({ type = "login" }: AuthPageProps) => {
  const [email, setEmail] = React.useState("info@refine.dev")
  const [password, setPassword] = React.useState("refine-supabase")
  const [isLoading, setIsLoading] = React.useState(false)

  const { mutate: login } = useLogin()
  const { mutate: register } = useRegister()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    if (type === "register") {
      register({ email, password })
    } else {
      login({ email, password })
    }
    
    setIsLoading(false)
  }

  return (
    <div className="container relative h-screen flex flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          ObjectTrack
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;A modern blog management system built with Next.js and Refine.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">
                {type === "register" ? "Create an account" : "Sign in"}
              </CardTitle>
              <CardDescription>
                {type === "register" 
                  ? "Enter your email below to create your account"
                  : "Enter your email and password to sign in"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="m@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Loading..." : type === "register" ? "Create Account" : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
