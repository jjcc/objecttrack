"use client"

import * as React from "react"
import { useCreate, useNavigation } from "@refinedev/core"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function CategoryCreate() {
  const [title, setTitle] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)

  const { mutate: createCategory } = useCreate()
  const { list } = useNavigation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    createCategory({
      resource: "categories",
      values: { title },
    }, {
      onSuccess: () => {
        list("categories")
      },
    })
    
    setIsLoading(false)
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create Category</CardTitle>
          <CardDescription>
            Create a new category.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter category title"
                required
              />
            </div>
            <div className="flex space-x-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Category"}
              </Button>
              <Button type="button" variant="outline" onClick={() => list("categories")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}