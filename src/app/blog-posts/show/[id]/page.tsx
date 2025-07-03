"use client"

import * as React from "react"
import { useOne, useNavigation } from "@refinedev/core"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BlogPostShow({ params }: { params: { id: string } }) {
  const { data: postData, isLoading } = useOne({
    resource: "blog_posts",
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

  const post = postData?.data

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>{post?.title}</CardTitle>
          <CardDescription>
            Status: {post?.status} • Created: {post?.createdAt ? format(new Date(post.createdAt), "MMM dd, yyyy") : "-"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap">{post?.content}</p>
          </div>
          <div className="mt-6 flex space-x-2">
            <Button onClick={() => edit("blog_posts", params.id)}>
              Edit
            </Button>
            <Button variant="outline" onClick={() => list("blog_posts")}>
              Back to List
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}