"use client"

import * as React from "react"
import { useOne, useUpdate, useNavigation } from "@refinedev/core"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function CategoryEdit({ params }: { params: { id: string } }) {
  const [title, setTitle] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)

  const { data: categoryData, isLoading: isLoadingCategory } = useOne({
    resource: "categories",
    id: params.id,
  })
  
  const { mutate: updateCategory } = useUpdate()
  const { list } = useNavigation()

  React.useEffect(() => {
    if (categoryData?.data) {
      setTitle(categoryData.data.title || "")
    }
  }, [categoryData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    updateCategory({
      resource: "categories",
      id: params.id,
      values: { title },
    }, {
      onSuccess: () => {
        list("categories")
      },
    })
    
    setIsLoading(false)
  }

  if (isLoadingCategory) {
    return (
      <div className="container mx-auto py-10">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Edit Category</CardTitle>
          <CardDescription>
            Update your category.
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
                {isLoading ? "Updating..." : "Update Category"}
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