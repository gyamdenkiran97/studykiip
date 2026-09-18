"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { moderateReviewAction } from "@/server/actions/admin/moderation";

export function ReviewModeration({ reviewId, status }: { reviewId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function moderate(next: "PUBLISHED" | "REJECTED") {
    setPending(true);
    const result = await moderateReviewAction({ reviewId, status: next });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(next === "PUBLISHED" ? "Review published" : "Review rejected");
    router.refresh();
  }

  return (
    <div className="flex shrink-0 gap-2">
      {status !== "PUBLISHED" ? (
        <Button size="sm" disabled={pending} onClick={() => moderate("PUBLISHED")}>
          Publish
        </Button>
      ) : null}
      {status !== "REJECTED" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => moderate("REJECTED")}>
          Reject
        </Button>
      ) : null}
    </div>
  );
}
