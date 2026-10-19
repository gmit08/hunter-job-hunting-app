import type { Application } from "@/lib/applications";
import { formatShortDate } from "@/lib/applications";
import { formatScore, StatusPill } from "@/components/status-pill";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function RichValue({ value }: { value: string }) {
  const parts = value.split(/(https?:\/\/[^\s]+)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (!/^https?:\/\//.test(part)) return <span key={index}>{part}</span>;
        const href = part.replace(/[),.;]+$/g, "");
        return (
          <span key={index}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-primary underline underline-offset-2"
            >
              {href}
            </a>
            {part.slice(href.length)}
          </span>
        );
      })}
    </span>
  );
}

export function ApplicationDetail({
  application,
  onClose,
}: {
  application: Application | null;
  onClose: () => void;
}) {
  const filled = application?.fields.filter((field) => field.value) ?? [];

  return (
    <Dialog open={application != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(85vh,760px)] overflow-y-auto sm:max-w-2xl">
        {application ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl leading-tight">{application.company}</DialogTitle>
              <DialogDescription className="text-base text-foreground">{application.role || "Role not listed"}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={application.status} />
              <span className="text-sm text-muted-foreground">{formatShortDate(application.dateApplied)}</span>
              <span className="text-sm text-muted-foreground">Score {formatScore(application.score)}</span>
              <span className="text-sm text-muted-foreground">Match {formatScore(application.matchScore)}</span>
            </div>
            <dl className="grid gap-4">
              {filled.map((field, index) => (
                <div key={`${field.header}-${index}`} className="grid gap-1">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{field.header}</dt>
                  <dd className="text-sm leading-6">
                    <RichValue value={field.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
