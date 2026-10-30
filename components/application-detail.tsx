import type { Application } from "@/lib/applications";
import { formatShortDate } from "@/lib/applications";
import { formatScore, StatusPill } from "@/components/status-pill";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APPLY_LINK_LABEL, firstUrl, isApplicationLinkField, splitDisplayText } from "@/lib/display-text";

function ApplyLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
      {APPLY_LINK_LABEL}
    </a>
  );
}

function FieldValue({ header, value }: { header: string; value: string }) {
  if (isApplicationLinkField(header)) {
    const href = firstUrl(value);
    if (!href) return null;
    return <ApplyLink href={href} />;
  }
  const display = splitDisplayText(value);
  if (!display.text && !display.applyHref) return null;
  return (
    <span className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
      {display.text}
      {display.applyHref ? (
        <>
          {display.text ? " " : null}
          <ApplyLink href={display.applyHref} />
        </>
      ) : null}
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
      <DialogContent className="max-h-[min(85vh,760px)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        {application ? (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle className="break-words font-heading text-2xl leading-tight [overflow-wrap:anywhere]">{application.company}</DialogTitle>
              <DialogDescription className="break-words text-base text-foreground [overflow-wrap:anywhere]">{application.role || "Role not listed"}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={application.status} />
              <span className="text-sm text-muted-foreground">{formatShortDate(application.dateApplied)}</span>
              <span className="text-sm text-muted-foreground">Score {formatScore(application.score)}</span>
              <span className="text-sm text-muted-foreground">Match {formatScore(application.matchScore)}</span>
            </div>
            <dl className="grid min-w-0 gap-4">
              {filled.map((field, index) => (
                <div key={`${field.header}-${index}`} className="grid min-w-0 gap-1">
                  <dt className="text-xs font-medium tracking-wide break-words text-muted-foreground uppercase [overflow-wrap:anywhere]">{field.header}</dt>
                  <dd className="min-w-0 text-sm leading-6 break-words [overflow-wrap:anywhere]">
                    <FieldValue header={field.header} value={field.value} />
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
