"use client";
import { useEffect } from "react";
import { syncUser } from "@/app/actions/userActions";

export default function Dashboard() {
  useEffect(() => {
    syncUser();
  }, []);

  return <div>Dashboard</div>;
}