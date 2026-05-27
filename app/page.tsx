"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore, isOnboarded } from "@/store/profileStore";
import Spinner from "@/components/Spinner";

export default function RootPage() {
  const router = useRouter();
  const { profile, loading, load } = useProfileStore();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading) {
      if (isOnboarded(profile)) {
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
    }
  }, [loading, profile, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner />
    </div>
  );
}
