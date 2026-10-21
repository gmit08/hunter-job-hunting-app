"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const [trying, setTrying] = useState(false);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16">
      <p className="font-heading text-2xl leading-none font-medium tracking-tight">Hunter</p>
      <h1 className="mt-2 font-heading text-3xl font-medium">The dashboard hit a snag</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Nothing was changed in your spreadsheet. Try again, and if it keeps happening, refresh the page.
      </p>
      <Button
        className="mt-6 h-11 w-fit px-4"
        disabled={trying}
        onClick={() => {
          setTrying(true);
          reset();
        }}
      >
        Try again
      </Button>
    </main>
  );
}
