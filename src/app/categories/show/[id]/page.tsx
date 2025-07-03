"use client"

import * as React from "react"
import { useOne, useNavigation } from "@refinedev/core"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function CategoryShow({ params }: { params: { id: string } }) {
  const { data: categoryData, isLoading } = useOne({
    resource: "categories",
    id: params.id,
  })
  
  const { list, edit } = useNavigation()

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div>Loading...</div>
      </div>
    )
  }

  const category = categoryData?.data

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>{category?.title}</CardTitle>
          <CardDescription>
            Created: {category?.createdAt ? format(new Date(category.createdAt), "MMM dd, yyyy") : "-"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mt-6 flex space-x-2">
            <Button onClick={() => edit("categories", params.id)}>
              Edit
            </Button>
            <Button variant="outline" onClick={() => list("categories")}>
              Back to List
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}